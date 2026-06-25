import OpenAI from "openai"
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionContentPartText,
} from "openai/resources/chat/completions"
import { BaseLlm } from "@google/adk"
import type { BaseLlmConnection, LlmRequest, LlmResponse } from "@google/adk"
import type {
  Content,
  Part,
  FunctionCall,
  FunctionResponse,
} from "@google/genai"

/*
 * OpenAI-compatible adapter for adk-js. "OpenAI-compatible" is a wire
 * protocol, not a vendor - OpenRouter and Ollama both expose it. This one
 * adapter serves both providers; the difference is purely `baseUrl` + key
 * (see resolveLlm() in llm-registry.ts).
 *
 * Targets the Chat Completions API (/v1/chat/completions) - the broadest
 * tool-calling surface across OpenRouter + Ollama. Not /v1/responses.
 *
 * Maps ADK's Gemini-shaped LlmRequest / LlmResponse / Content over OpenAI's
 * chat messages API. Structured to mirror anthropic-llm.ts:
 *   ✓ Text streaming (delta.content → partial ContentEvent chunks)
 *   ✓ Tool use roundtrip - functionCall → tool_calls, functionResponse →
 *     role:"tool" message
 *   ✓ System instruction extracted from llmRequest.config.systemInstruction
 *   ✓ usage metadata aggregated into the final LlmResponse
 *
 * No prompt-cache plumbing - OpenRouter/DeepSeek do context caching
 * server-side automatically; Ollama is local.
 *
 * OpenRouter extras handled here (no-ops on Ollama):
 *   - generation id: the top-level `id` of the completion is OpenRouter's
 *     generation handle. Surfaced on customMetadata so a run can later
 *     reconcile estimated cost against exact cost via GET /generation?id=.
 *   - web search: the `openrouter:web_search` server tool (the older
 *     `plugins:[{id:"web"}]` request param is deprecated). Enabled per-agent
 *     via the `webSearch` constructor flag, not the ADK tools path.
 *   - citations: web search returns url_citation annotations on the message;
 *     parsed into customMetadata.citations so source URLs survive even if the
 *     model doesn't echo them in prose.
 */

/* Per-model output ceilings. The previous flat 4096 silently truncated long
 * drafts/reviews on models that support far more. Unknown models fall back to
 * DEFAULT_MAX_TOKENS. Keyed by the post-prefix model id (vendor/model). */
const MODEL_OUTPUT_LIMITS: Record<string, number> = {
  "minimax/minimax-m3": 16_384,
  "z-ai/glm-5.2": 16_384,
  "anthropic/claude-haiku-4.5": 8_192,
  "google/gemini-3.1-flash-lite": 8_192,
}

const DEFAULT_MAX_TOKENS = 8_192

function resolveMaxTokens(model: string, override?: number): number {
  return override ?? MODEL_OUTPUT_LIMITS[model] ?? DEFAULT_MAX_TOKENS
}

/* OpenRouter server tool for live web search. `type` is the OpenRouter-
 * specific slug, so it does not satisfy the OpenAI SDK's tool union - the
 * params object is cast at the call site. */
const WEB_SEARCH_TOOL = {
  type: "openrouter:web_search",
  parameters: { max_results: 5, engine: "auto" },
} as const

interface ParsedCitation {
  url: string
  title?: string
}

export interface OpenAiCompatibleLlmOptions {
  model?: string
  apiKey?: string
  baseUrl?: string
  /** Enable OpenRouter's web-search server tool for this agent. */
  webSearch?: boolean
  /** Hard override of the per-model output ceiling. */
  maxTokens?: number
}

export class OpenAiCompatibleLlm extends BaseLlm {
  /* Resolution is by agentConfig.provider in resolveLlm(), not by this
   * regex - the LLMRegistry registration is belt-and-braces. Keep it
   * permissive: OpenRouter slugs are `vendor/model`, Ollama tags are
   * `model:size`; neither shares a stable prefix. */
  static override readonly supportedModels: Array<string | RegExp> = [
    /^openrouter\//,
    /^ollama\//,
  ]

  private readonly client: OpenAI
  private readonly webSearch: boolean
  private readonly maxTokensOverride?: number

  constructor(params: OpenAiCompatibleLlmOptions = {}) {
    super({ model: params.model ?? "" })
    this.client = new OpenAI({
      apiKey: params.apiKey ?? "not-needed",
      baseURL: params.baseUrl,
    })
    this.webSearch = params.webSearch ?? false
    this.maxTokensOverride = params.maxTokens
  }

  override async *generateContentAsync(
    llmRequest: LlmRequest,
    stream?: boolean,
    abortSignal?: AbortSignal,
  ): AsyncGenerator<LlmResponse, void> {
    const systemText = extractSystemPrompt(llmRequest)
    const tools = buildOpenAiTools(llmRequest)
    const messages = buildOpenAiMessages(llmRequest.contents, systemText)
    const modelName = (llmRequest.model || this.model).replace(
      /^(openrouter|ollama)\//,
      "",
    )

    const allTools = this.webSearch ? [...tools, WEB_SEARCH_TOOL] : tools
    const params = {
      model: modelName,
      max_tokens: resolveMaxTokens(modelName, this.maxTokensOverride),
      messages,
      /* Streamed responses omit token usage unless explicitly requested; without
       * this the final chunk carries no usage and every run meters as 0 tokens
       * / $0, starving the cost dashboards. */
      stream_options: { include_usage: true },
      ...(allTools.length ? { tools: allTools } : {}),
    }

    /* Use the chat.completions.stream() helper - like anthropic-llm.ts it
     * correctly aggregates tool_call argument deltas across chunks. We
     * iterate raw chunks to yield partial:true text for the chat UI, then
     * await finalChatCompletion() for the fully-parsed message.
     *
     * Cast: params carries the OpenRouter-specific web_search tool slug,
     * which the OpenAI SDK's tool union doesn't model. */
    const completionStream = this.client.chat.completions.stream(
      params as Parameters<typeof this.client.chat.completions.stream>[0],
      { signal: abortSignal },
    )

    if (stream !== false) {
      for await (const chunk of completionStream) {
        if (abortSignal?.aborted) return
        const delta = chunk.choices[0]?.delta?.content
        if (delta) {
          yield {
            content: { role: "model", parts: [{ text: delta }] },
            partial: true,
          } satisfies LlmResponse
        }
      }
    } else {
      // Non-streaming: drain without yielding partials.
      const streamIterator = completionStream[Symbol.asyncIterator]()
      while (!(await streamIterator.next()).done) {
        if (abortSignal?.aborted) break
      }
    }

    const final = await completionStream.finalChatCompletion()
    const message = final.choices[0]?.message

    const parts: Part[] = []
    if (message?.content) parts.push({ text: message.content })
    for (const call of message?.tool_calls ?? []) {
      if (call.type !== "function") continue
      parts.push({
        functionCall: {
          id: call.id,
          name: call.function.name,
          args: safeParseArgs(call.function.arguments),
        } as FunctionCall,
      })
    }

    const inTok = final.usage?.prompt_tokens ?? 0
    const outTok = final.usage?.completion_tokens ?? 0
    const finishReasonRaw = final.choices[0]?.finish_reason ?? undefined
    const citations = parseCitations(message)
    /* OpenRouter returns the generation handle as the completion's top-level
     * id; Ollama returns its own id we simply ignore downstream. */
    const generationId = final.id || undefined

    /* Truncation guard. A reasoning model (e.g. minimax-m3) can spend the
     * whole output budget on hidden reasoning and return zero content with
     * finish_reason "length". Without this, the run yields nothing yet marks
     * "succeeded" - a silent empty post. Surface it as an error so the run
     * fails visibly and the cap can be raised. */
    if (parts.length === 0 && finishReasonRaw === "length") {
      yield {
        errorCode: "MAX_TOKENS",
        errorMessage: `Model ${modelName} reached the output token cap before producing any content (likely reasoning-token exhaustion). Raise the per-model cap in MODEL_OUTPUT_LIMITS.`,
        partial: false,
        turnComplete: true,
        ...(generationId
          ? { customMetadata: { openrouterGenerationId: generationId } }
          : {}),
        usageMetadata: {
          promptTokenCount: inTok,
          candidatesTokenCount: outTok,
          totalTokenCount: inTok + outTok,
        } as never,
      } satisfies LlmResponse
      return
    }

    const customMetadata =
      generationId || citations.length
        ? {
            ...(generationId ? { openrouterGenerationId: generationId } : {}),
            ...(citations.length ? { citations } : {}),
          }
        : undefined
    yield {
      content: parts.length ? { role: "model", parts } : undefined,
      partial: false,
      turnComplete: true,
      finishReason: mapFinishReason(finishReasonRaw) as never,
      ...(customMetadata ? { customMetadata } : {}),
      usageMetadata: {
        promptTokenCount: inTok,
        candidatesTokenCount: outTok,
        totalTokenCount: inTok + outTok,
      } as never,
    } satisfies LlmResponse
  }

  override async connect(): Promise<BaseLlmConnection> {
    throw new Error(
      "OpenAiCompatibleLlm does not support live bidi connections",
    )
  }
}

/* OpenRouter standardises web-search results onto the OpenAI annotation
 * schema: message.annotations[] with type "url_citation" and a nested
 * url_citation:{url,title}. Read loosely - the SDK types annotations but not
 * OpenRouter's extra `content` excerpt field. */
function parseCitations(message: unknown): ParsedCitation[] {
  const annotations = (message as {
    annotations?: Array<{
      type?: string
      url_citation?: { url?: string; title?: string }
    }>
  } | null | undefined)?.annotations
  if (!Array.isArray(annotations)) return []
  const out: ParsedCitation[] = []
  const seen = new Set<string>()
  for (const a of annotations) {
    if (a?.type !== "url_citation") continue
    const url = a.url_citation?.url
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push({ url, ...(a.url_citation?.title ? { title: a.url_citation.title } : {}) })
  }
  return out
}

function safeParseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
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

function buildOpenAiTools(req: LlmRequest): ChatCompletionTool[] {
  const toolsDict = req.toolsDict ?? {}
  const out: ChatCompletionTool[] = []
  for (const tool of Object.values(toolsDict)) {
    const decl = (tool as { _getDeclaration?: () => {
      name?: string
      description?: string
      parameters?: Record<string, unknown>
    } })._getDeclaration?.()
    if (!decl?.name) continue
    const schema = decl.parameters
      ? (normalizeSchemaTypes(decl.parameters) as Record<string, unknown>)
      : { type: "object", properties: {} }
    out.push({
      type: "function",
      function: {
        name: decl.name,
        description: decl.description ?? "",
        parameters: schema,
      },
    })
  }
  return out
}

/* Same problem as anthropic-llm.ts: ADK's GenAI-flavoured declarations emit
 * uppercase `type` values, non-standard fields, and numeric keywords as
 * strings. OpenAI's function schema validator is JSON Schema based and
 * rejects the same things. Allowlist the keywords OpenAI accepts. */
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
      else if (Array.isArray(v))
        out.type = v.map((x) => (typeof x === "string" ? x.toLowerCase() : x))
    } else if (k === "properties" && v && typeof v === "object") {
      const props: Record<string, unknown> = {}
      for (const [pname, pschema] of Object.entries(
        v as Record<string, unknown>,
      )) {
        props[pname] = normalizeSchemaTypes(pschema)
      }
      out.properties = props
    } else if (k === "items" || k === "additionalProperties" || k === "not") {
      out[k] = normalizeSchemaTypes(v)
    } else if (
      k === "anyOf" ||
      k === "oneOf" ||
      k === "allOf" ||
      k === "prefixItems"
    ) {
      out[k] = Array.isArray(v)
        ? v.map(normalizeSchemaTypes)
        : normalizeSchemaTypes(v)
    } else if (k === "format" && typeof v === "string") {
      if (STANDARD_FORMATS.has(v)) out.format = v
    } else if (NUMERIC_KEYS.has(k)) {
      const n = coerceNumber(v)
      if (n !== undefined) out[k] = n
    } else if (SCHEMA_PASSTHROUGH_KEYS.has(k)) {
      out[k] = v
    }
    /* else: silently drop nullable, propertyOrdering, $schema, etc. */
  }

  if (
    (obj as { nullable?: boolean }).nullable === true &&
    typeof out.type === "string"
  ) {
    out.type = [out.type, "null"]
  }

  return out
}

/* ADK groups a turn's parts into one Content. OpenAI needs functionResponse
 * parts split into their own role:"tool" messages, and assistant tool_calls
 * carried on the assistant message. */
function buildOpenAiMessages(
  contents: Content[],
  systemText: string | undefined,
): ChatCompletionMessageParam[] {
  const out: ChatCompletionMessageParam[] = []
  if (systemText) out.push({ role: "system", content: systemText })

  for (const c of contents) {
    const textParts: ChatCompletionContentPartText[] = []
    const toolCalls: Array<{
      id: string
      type: "function"
      function: { name: string; arguments: string }
    }> = []
    const toolResults: ChatCompletionMessageParam[] = []

    for (const part of c.parts ?? []) {
      if ("text" in part && part.text) {
        textParts.push({ type: "text", text: part.text })
      } else if ("functionCall" in part && part.functionCall) {
        const fc = part.functionCall
        toolCalls.push({
          id: fc.id ?? `tool_${toolCalls.length}`,
          type: "function",
          function: {
            name: fc.name ?? "tool",
            arguments: JSON.stringify(fc.args ?? {}),
          },
        })
      } else if ("functionResponse" in part && part.functionResponse) {
        const fr = part.functionResponse as FunctionResponse
        toolResults.push({
          role: "tool",
          tool_call_id: fr.id ?? "",
          content: stringifyFunctionResponse(fr),
        })
      }
    }

    if (c.role === "model") {
      if (textParts.length || toolCalls.length) {
        out.push({
          role: "assistant",
          content: textParts.length
            ? textParts.map((t) => t.text).join("")
            : null,
          ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
        })
      }
    } else if (textParts.length) {
      out.push({ role: "user", content: textParts.map((t) => t.text).join("") })
    }

    // tool_result messages must follow the assistant message that called them.
    out.push(...toolResults)
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
    case "stop":
      return "STOP"
    case "length":
      return "MAX_TOKENS"
    case "tool_calls":
      return "STOP"
    case "content_filter":
      return "SAFETY"
    default:
      return stop
  }
}
