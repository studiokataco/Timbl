import Anthropic from "@anthropic-ai/sdk"
import type {
  ContentBlockParam,
  MessageCreateParamsStreaming,
  MessageParam,
  RawMessageStreamEvent,
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
 *   ✓ Tool use roundtrip — function call → Anthropic tool_use, then ADK
 *     functionResponse → Anthropic tool_result
 *   ✓ System instruction extracted from llmRequest.config.systemInstruction
 *   ✓ usage metadata aggregated into the final LlmResponse
 *   ✗ Extended thinking / cache_control / images / citations / web search
 *     — Phase 4 stays focused; extend as workflows need it.
 *
 * Tools: ADK supplies LlmRequest.toolsDict — a map of name → BaseTool with
 * a `_getDeclaration()` that returns a Gemini FunctionDeclaration. The
 * declaration's `parameters` is a JSON-schema-ish object compatible with
 * Anthropic's input_schema. We pass it straight through.
 */

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6"
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
    const messages = buildAnthropicMessages(llmRequest.contents)
    const modelName = (llmRequest.model || this.model).replace(/^anthropic\//, "")

    /* Prompt caching — Anthropic ephemeral cache (5-min TTL). Mark the
     * system prompt and the last tool with cache_control so the system
     * block + the entire tools array get cached. On repeat turns in a
     * review loop (drafter + reviewer), the cache hit drops input cost
     * on those segments by ~90%. Messages are not cached — they change
     * every turn and caching them yields nothing. */
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

    /* Streaming path. We consume RawMessageStreamEvent chunks and yield
     * partial LlmResponses for text content; we buffer tool_use blocks
     * until their stop event before yielding a single LlmResponse with a
     * functionCall part. */
    let outputText = ""
    let pendingToolUse:
      | { id: string; name: string; jsonChunks: string[] }
      | undefined
    const usage = { input_tokens: 0, output_tokens: 0 }
    let finishReason: string | undefined

    const iterator = (await this.client.messages.create(base, {
      signal: abortSignal,
    })) as AsyncIterable<RawMessageStreamEvent>

    for await (const event of iterator) {
      if (abortSignal?.aborted) return
      switch (event.type) {
        case "message_start":
          if (event.message.usage) {
            usage.input_tokens = event.message.usage.input_tokens ?? 0
          }
          break
        case "content_block_start": {
          if (event.content_block.type === "tool_use") {
            pendingToolUse = {
              id: event.content_block.id,
              name: event.content_block.name,
              jsonChunks: [],
            }
          }
          break
        }
        case "content_block_delta": {
          const delta = event.delta
          if (delta.type === "text_delta") {
            outputText += delta.text
            yield {
              content: { role: "model", parts: [{ text: delta.text }] },
              partial: true,
            } satisfies LlmResponse
          } else if (delta.type === "input_json_delta" && pendingToolUse) {
            pendingToolUse.jsonChunks.push(delta.partial_json)
          }
          break
        }
        case "content_block_stop": {
          if (pendingToolUse) {
            const fullJson = pendingToolUse.jsonChunks.join("")
            let args: Record<string, unknown> = {}
            try {
              args = fullJson ? (JSON.parse(fullJson) as Record<string, unknown>) : {}
            } catch {
              /* If the tool call args don't parse, emit them as a string so
               * the agent can correct on retry. */
              args = { _raw: fullJson }
            }
            yield {
              content: {
                role: "model",
                parts: [
                  {
                    functionCall: {
                      id: pendingToolUse.id,
                      name: pendingToolUse.name,
                      args,
                    } as FunctionCall,
                  },
                ],
              },
              partial: false,
            } satisfies LlmResponse
            pendingToolUse = undefined
          }
          break
        }
        case "message_delta":
          if (event.usage) usage.output_tokens = event.usage.output_tokens ?? 0
          if (event.delta.stop_reason) finishReason = event.delta.stop_reason
          break
        case "message_stop":
          // Final aggregate LlmResponse — completes the turn.
          yield {
            content: outputText
              ? { role: "model", parts: [{ text: outputText }] }
              : undefined,
            partial: false,
            turnComplete: true,
            finishReason: mapFinishReason(finishReason) as never,
            usageMetadata: {
              promptTokenCount: usage.input_tokens,
              candidatesTokenCount: usage.output_tokens,
              totalTokenCount: usage.input_tokens + usage.output_tokens,
            } as never,
          } satisfies LlmResponse
          return
      }
    }
  }

  override async connect(): Promise<BaseLlmConnection> {
    throw new Error(
      "AnthropicLlm does not support live bidi connections (no Anthropic equivalent of Gemini Live)",
    )
  }

  private async collectFullResponse(
    params: MessageCreateParamsStreaming,
    abortSignal?: AbortSignal,
  ): Promise<LlmResponse> {
    let text = ""
    const functionCalls: FunctionCall[] = []
    const usage = { input_tokens: 0, output_tokens: 0 }
    let finishReason: string | undefined

    for await (const ev of (await this.client.messages.create(params, {
      signal: abortSignal,
    })) as AsyncIterable<RawMessageStreamEvent>) {
      if (ev.type === "content_block_start" && ev.content_block.type === "tool_use") {
        functionCalls.push({
          id: ev.content_block.id,
          name: ev.content_block.name,
          args: (ev.content_block.input ?? {}) as Record<string, unknown>,
        } as FunctionCall)
      } else if (
        ev.type === "content_block_delta" &&
        ev.delta.type === "text_delta"
      ) {
        text += ev.delta.text
      } else if (ev.type === "message_delta") {
        usage.output_tokens = ev.usage?.output_tokens ?? usage.output_tokens
        finishReason = ev.delta.stop_reason ?? finishReason
      } else if (ev.type === "message_start") {
        usage.input_tokens = ev.message.usage?.input_tokens ?? 0
      }
    }
    const parts: Part[] = []
    if (text) parts.push({ text })
    for (const fc of functionCalls) parts.push({ functionCall: fc })
    return {
      content: parts.length ? { role: "model", parts } : undefined,
      turnComplete: true,
      finishReason: mapFinishReason(finishReason) as never,
      usageMetadata: {
        promptTokenCount: usage.input_tokens,
        candidatesTokenCount: usage.output_tokens,
        totalTokenCount: usage.input_tokens + usage.output_tokens,
      } as never,
    }
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
 *      "INTEGER", "NUMBER", "BOOLEAN") — must be lowercased.
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
   * — JSON Schema 2020-12 allows array of types. */
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

/* Anthropic cache-control marker — minimum cacheable size is ~1024 tokens
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
  /* Cache boundary applies to all items up to and including the marker —
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
