import Anthropic from "@anthropic-ai/sdk"
import type {
  ContentBlockParam,
  Message as AnthropicMessage,
  MessageCreateParamsStreaming,
  MessageParam,
  TextBlockParam,
  Tool as AnthropicTool,
  ToolUseBlockParam,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages"
import { BaseLlm } from "@google/adk"
import type { BaseLlmConnection, LlmRequest, LlmResponse } from "@google/adk"
import type {
  Content,
  Part,
  FunctionCall,
  FunctionResponse,
} from "@google/genai"

/*
 * Anthropic adapter for adk-js. Maps ADK's Gemini-shaped LlmRequest /
 * LlmResponse / Content over Anthropic's messages API.
 *
 * Scope of this implementation:
 *   ✓ Text streaming (content_block_delta → ContentEvent chunks)
 *   ✓ Tool use roundtrip - function call → Anthropic tool_use, then ADK
 *     functionResponse → Anthropic tool_result
 *   ✓ System instruction extracted from llmRequest.config.systemInstruction
 *   ✓ usage metadata aggregated into the final LlmResponse (incl. cache
 *     read/write token counts, surfaced as cachedContentTokenCount)
 *   ✓ Prompt caching - system + tools + a rolling conversation-prefix
 *     breakpoint so loop iterations re-read prior turns from cache
 *   ✗ Extended thinking / images / citations / web search
 *     - Phase 4 stays focused; extend as workflows need it.
 *
 * Tools: ADK supplies LlmRequest.toolsDict - a map of name → BaseTool with
 * a `_getDeclaration()` that returns a Gemini FunctionDeclaration. The
 * declaration's `parameters` is a JSON-schema-ish object compatible with
 * Anthropic's input_schema. We pass it straight through.
 */

/* Haiku 4.5 - ~3× cheaper than Sonnet 4.6 on both input and output tokens,
 * and handles parallel tool calls + medium-length drafts well. If you need
 * the heavier reasoning of Sonnet, set `model` on the AgentConfig directly
 * rather than flipping this default. */
const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"
const DEFAULT_MAX_TOKENS = 4096

export class AnthropicLlm extends BaseLlm {
  static override readonly supportedModels: Array<string | RegExp> = [
    /^claude-/,
    /^anthropic\//,
  ]

  private readonly client: Anthropic

  constructor(params: { model?: string; apiKey?: string } = {}) {
    super({ model: params.model ?? DEFAULT_ANTHROPIC_MODEL })
    this.client = new Anthropic({
      apiKey: params.apiKey ?? process.env.ANTHROPIC_API_KEY,
    })
  }

  override async *generateContentAsync(
    llmRequest: LlmRequest,
    stream?: boolean,
    abortSignal?: AbortSignal,
  ): AsyncGenerator<LlmResponse, void> {
    const systemText = extractSystemPrompt(llmRequest)
    const tools = buildAnthropicTools(llmRequest)
    const messages = withMessagesCache(buildAnthropicMessages(llmRequest.contents))
    const modelName = (llmRequest.model || this.model).replace(/^anthropic\//, "")

    /* Prompt caching - Anthropic ephemeral cache (5-min TTL). Three cache
     * segments, within the 4-breakpoint limit:
     *   1. system block        (withSystemCache)
     *   2. the tools array      (withToolsCache - marks the last tool)
     *   3. the conversation prefix (withMessagesCache - rolling breakpoints)
     * The third is the important one for the draft->review LoopAgent: the
     * message history grows every iteration, so without a breakpoint there
     * the whole (growing) prefix is re-billed at full input price each turn.
     * With it, prior turns - including every prior tool_use/tool_result -
     * come back as a cache READ (~0.1x input). */
    const system = withSystemCache(systemText)
    const toolsWithCache = withToolsCache(tools)

    const base: MessageCreateParamsStreaming = {
      model: modelName,
      max_tokens: DEFAULT_MAX_TOKENS,
      system,
      messages,
      tools: toolsWithCache,
      stream: true,
    }

    if (stream === false) {
      // Non-streaming path: collect the full stream into a single response.
      const final = await this.collectFullResponse(base, abortSignal)
      yield final
      return
    }

    /* Streaming path.
     *
     * Use messages.stream() (the SDK helper) instead of raw
     * messages.create({stream:true}). The helper correctly aggregates
     * tool_use input across input_json_delta chunks; the raw event path
     * silently dropped them under some conditions, yielding args={} to
     * ADK and making every tool call fail zod parse.
     *
     * We still iterate raw events so we can yield partial:true text
     * deltas for the chat UI, then await finalMessage() at the end to
     * read the fully-parsed content blocks (with complete tool inputs)
     * and emit ONE non-partial LlmResponse with all parts. */
    const { stream: _omit, ...streamParams } = base as MessageCreateParamsStreaming & {
      stream?: true
    }
    void _omit

    const msgStream = this.client.messages.stream(streamParams, {
      signal: abortSignal,
    })

    for await (const event of msgStream) {
      if (abortSignal?.aborted) return
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield {
          content: { role: "model", parts: [{ text: event.delta.text }] },
          partial: true,
        } satisfies LlmResponse
      }
    }

    const finalMessage = await msgStream.finalMessage()
    yield { ...finalMessageToResponse(finalMessage), partial: false } satisfies LlmResponse
  }

  override async connect(): Promise<BaseLlmConnection> {
    throw new Error(
      "AnthropicLlm does not support live bidi connections (no Anthropic equivalent of Gemini Live)",
    )
  }

  /* Non-streaming path. ADK runs this when runConfig.streamingMode !== SSE,
   * which is the default for /api/agents/{agent}/run since the route handler
   * doesn't set a streamingMode. Use the SDK's messages.stream() helper -
   * the same one the streaming path uses - so tool_use blocks come back with
   * fully-aggregated `input`. The previous implementation read
   * content_block.input at content_block_start time when it's still empty,
   * which is exactly why every agent call landed at ADK with args={}. */
  private async collectFullResponse(
    params: MessageCreateParamsStreaming,
    abortSignal?: AbortSignal,
  ): Promise<LlmResponse> {
    const { stream: _omit, ...streamParams } = params as MessageCreateParamsStreaming & {
      stream?: true
    }
    void _omit

    const msgStream = this.client.messages.stream(streamParams, {
      signal: abortSignal,
    })

    // Drain the stream - we don't yield partials in the non-streaming path.
    const streamIterator = msgStream[Symbol.asyncIterator]()
    while (!(await streamIterator.next()).done) {
      if (abortSignal?.aborted) break
    }

    const finalMessage = await msgStream.finalMessage()
    return finalMessageToResponse(finalMessage)
  }
}

/* Build the single non-partial LlmResponse from Anthropic's final message.
 * Shared by the streaming and non-streaming paths so token accounting can't
 * drift between them.
 *
 * Token accounting: Anthropic reports input_tokens EXCLUDING cached tokens;
 * cache reads/writes are separate counters. We roll them into a single
 * promptTokenCount (the true context size billed this turn) and expose the
 * cache-read portion as cachedContentTokenCount so cost estimation can apply
 * the cache discount and so the run UI can show whether caching is working. */
function finalMessageToResponse(finalMessage: AnthropicMessage): LlmResponse {
  const parts: Part[] = []
  for (const block of finalMessage.content) {
    if (block.type === "text") {
      if (block.text) parts.push({ text: block.text })
    } else if (block.type === "tool_use") {
      parts.push({
        functionCall: {
          id: block.id,
          name: block.name,
          args: (block.input ?? {}) as Record<string, unknown>,
        } as FunctionCall,
      })
    }
  }

  const usage = finalMessage.usage
  const inTok = usage?.input_tokens ?? 0
  const outTok = usage?.output_tokens ?? 0
  const cacheRead = usage?.cache_read_input_tokens ?? 0
  const cacheWrite = usage?.cache_creation_input_tokens ?? 0
  const promptTokens = inTok + cacheRead + cacheWrite

  return {
    content: parts.length ? { role: "model", parts } : undefined,
    turnComplete: true,
    finishReason: mapFinishReason(finalMessage.stop_reason ?? undefined) as never,
    usageMetadata: {
      promptTokenCount: promptTokens,
      candidatesTokenCount: outTok,
      cachedContentTokenCount: cacheRead,
      totalTokenCount: promptTokens + outTok,
    } as never,
  }
}

function extractSystemPrompt(req: LlmRequest): string | undefined {
  const sys = (req.config as { systemInstruction?: unknown } | undefined)
    ?.systemInstruction
  if (!sys) return undefined
  if (typeof sys === "string") return sys
  if (typeof sys === "object" && sys && "parts" in sys) {
    const parts = (sys as { parts?: Array<{ text?: string }> }).parts ?? []
    return parts.map((p) => p.text ?? "").join("\n")
  }
  return undefined
}

function buildAnthropicTools(req: LlmRequest): AnthropicTool[] {
  const toolsDict = req.toolsDict ?? {}
  const out: AnthropicTool[] = []
  for (const tool of Object.values(toolsDict)) {
    const decl = (tool as { _getDeclaration?: () => {
      name?: string
      description?: string
      parameters?: Record<string, unknown>
    } })._getDeclaration?.()
    if (!decl?.name) continue
    const schema = decl.parameters
      ? (normalizeSchemaTypes(decl.parameters) as AnthropicTool["input_schema"])
      : ({ type: "object", properties: {} } as AnthropicTool["input_schema"])
    out.push({
      name: decl.name,
      description: decl.description ?? "",
      input_schema: schema,
    })
  }
  return out
}

/* Translate ADK/GenAI FunctionDeclaration schemas to strict JSON Schema
 * 2020-12 (what Anthropic's tools API requires). Two problems to fix:
 *
 *   1. `type` values are GenAI enum strings ("OBJECT", "STRING", "ARRAY",
 *      "INTEGER", "NUMBER", "BOOLEAN") - must be lowercased.
 *   2. GenAI adds non-standard fields (`nullable`, `propertyOrdering`,
 *      Google-flavoured `format` values like "int32") that fail
 *      Anthropic's strict 2020-12 validation.
 *
 * We allowlist only the keywords Anthropic accepts and drop everything
 * else. Recurse into the obvious schema-position fields (properties,
 * items, additionalProperties, anyOf/oneOf/allOf, prefixItems). */
const SCHEMA_PASSTHROUGH_KEYS = new Set([
  "description",
  "required",
  "enum",
  "const",
  "default",
  "pattern",
  "uniqueItems",
  "title",
])

/* JSON Schema 2020-12 requires these to be numbers. ADK's GenAI-flavoured
 * declaration emits them as STRINGS ("1", "2000"), which is enough on its
 * own to make Anthropic's strict validator reject the whole schema. */
const NUMERIC_KEYS = new Set([
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
])

function coerceNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function normalizeSchemaTypes(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(normalizeSchemaTypes)
  if (!node || typeof node !== "object") return node

  const obj = node as Record<string, unknown>
  const out: Record<string, unknown> = {}

  for (const [k, v] of Object.entries(obj)) {
    if (k === "type") {
      if (typeof v === "string") out.type = v.toLowerCase()
      else if (Array.isArray(v)) out.type = v.map((x) => (typeof x === "string" ? x.toLowerCase() : x))
    } else if (k === "properties" && v && typeof v === "object") {
      const props: Record<string, unknown> = {}
      for (const [pname, pschema] of Object.entries(v as Record<string, unknown>)) {
        props[pname] = normalizeSchemaTypes(pschema)
      }
      out.properties = props
    } else if (k === "items" || k === "additionalProperties" || k === "not") {
      out[k] = normalizeSchemaTypes(v)
    } else if (k === "anyOf" || k === "oneOf" || k === "allOf" || k === "prefixItems") {
      out[k] = Array.isArray(v) ? v.map(normalizeSchemaTypes) : normalizeSchemaTypes(v)
    } else if (k === "format" && typeof v === "string") {
      /* Only pass through standard JSON Schema formats. Google emits
       * "int32"/"int64" which aren't in the draft 2020-12 vocabulary and
       * cause Anthropic's validator to reject the whole schema. */
      if (STANDARD_FORMATS.has(v)) out.format = v
    } else if (NUMERIC_KEYS.has(k)) {
      const n = coerceNumber(v)
      if (n !== undefined) out[k] = n
    } else if (SCHEMA_PASSTHROUGH_KEYS.has(k)) {
      out[k] = v
    }
    /* else: silently drop (nullable, propertyOrdering, examples, $id,
     * $schema, etc.). Anthropic doesn't need any of these. */
  }

  /* If the original had `nullable: true`, model it as `type: [t, "null"]`
   * - JSON Schema 2020-12 allows array of types. */
  if ((obj as { nullable?: boolean }).nullable === true && typeof out.type === "string") {
    out.type = [out.type, "null"]
  }

  return out
}

const STANDARD_FORMATS = new Set([
  "date-time",
  "date",
  "time",
  "duration",
  "email",
  "hostname",
  "ipv4",
  "ipv6",
  "uri",
  "uri-reference",
  "uuid",
  "regex",
  "json-pointer",
])

/* Anthropic cache-control marker - minimum cacheable size is ~1024 tokens
 * (~4000 chars), so skip the marker on tiny inputs to avoid the API
 * rejecting the request or charging cache-write cost with no payoff. */
const CACHE_MIN_CHARS = 4_000

function withSystemCache(
  systemText: string | undefined,
): string | TextBlockParam[] | undefined {
  if (!systemText) return undefined
  if (systemText.length < CACHE_MIN_CHARS) return systemText
  return [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }]
}

function withToolsCache(tools: AnthropicTool[]): AnthropicTool[] | undefined {
  if (tools.length === 0) return undefined
  /* Cache boundary applies to all items up to and including the marker -
   * marking the LAST tool caches the entire tools array as one block. */
  const totalChars = tools.reduce(
    (n, t) =>
      n +
      (t.name?.length ?? 0) +
      (t.description?.length ?? 0) +
      JSON.stringify(t.input_schema ?? {}).length,
    0,
  )
  if (totalChars < CACHE_MIN_CHARS) return tools
  return tools.map((t, i, arr) =>
    i === arr.length - 1
      ? ({ ...t, cache_control: { type: "ephemeral" } } as AnthropicTool)
      : t,
  )
}

/* Mark the conversation prefix as cacheable. The history grows every loop
 * iteration, so we place breakpoints on the last block of the final two
 * messages: Anthropic matches the longest previously-cached prefix, so two
 * rolling markers near the tail keep the hit-rate high as the prefix advances
 * turn to turn. system + tools use up to 2 of the 4 allowed breakpoints,
 * leaving exactly the 2 we use here. Skip entirely on small histories where a
 * cache write would cost more than it saves. */
function withMessagesCache(messages: MessageParam[]): MessageParam[] {
  if (messages.length === 0) return messages
  const totalChars = messages.reduce((n, m) => n + messageChars(m), 0)
  if (totalChars < CACHE_MIN_CHARS) return messages

  const marks = new Set<number>([messages.length - 1])
  if (messages.length >= 3) marks.add(messages.length - 2)

  return messages.map((m, i) => (marks.has(i) ? markLastBlock(m) : m))
}

function messageChars(m: MessageParam): number {
  if (typeof m.content === "string") return m.content.length
  return m.content.reduce((n, b) => n + JSON.stringify(b).length, 0)
}

function markLastBlock(m: MessageParam): MessageParam {
  if (typeof m.content === "string") {
    return {
      ...m,
      content: [
        { type: "text", text: m.content, cache_control: { type: "ephemeral" } },
      ],
    }
  }
  if (m.content.length === 0) return m
  const head = m.content.slice(0, -1)
  const last = m.content[m.content.length - 1]
  const marked = { ...last, cache_control: { type: "ephemeral" } } as ContentBlockParam
  return { ...m, content: [...head, marked] }
}

function buildAnthropicMessages(contents: Content[]): MessageParam[] {
  const out: MessageParam[] = []
  for (const c of contents) {
    const role = c.role === "model" ? "assistant" : "user"
    const blocks: ContentBlockParam[] = []
    for (const part of c.parts ?? []) {
      if ("text" in part && part.text) {
        blocks.push({ type: "text", text: part.text })
      } else if ("functionCall" in part && part.functionCall) {
        const fc = part.functionCall
        blocks.push({
          type: "tool_use",
          id: fc.id ?? `tool_${blocks.length}`,
          name: fc.name ?? "tool",
          input: (fc.args ?? {}) as Record<string, unknown>,
        } satisfies ToolUseBlockParam)
      } else if ("functionResponse" in part && part.functionResponse) {
        const fr = part.functionResponse as FunctionResponse
        blocks.push({
          type: "tool_result",
          tool_use_id: fr.id ?? "",
          content: stringifyFunctionResponse(fr),
        } satisfies ToolResultBlockParam)
      }
    }
    if (blocks.length === 0) continue
    out.push({ role, content: blocks })
  }
  return out
}

function stringifyFunctionResponse(fr: FunctionResponse): string {
  if (typeof fr.response === "string") return fr.response
  try {
    return JSON.stringify(fr.response ?? {})
  } catch {
    return String(fr.response)
  }
}

function mapFinishReason(stop?: string): string | undefined {
  switch (stop) {
    case "end_turn":
      return "STOP"
    case "max_tokens":
      return "MAX_TOKENS"
    case "stop_sequence":
      return "STOP"
    case "tool_use":
      return "STOP"
    default:
      return stop
  }
}
