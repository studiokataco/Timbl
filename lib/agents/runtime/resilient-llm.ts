import { BaseLlm } from "@google/adk"
import type { BaseLlmConnection, LlmRequest, LlmResponse } from "@google/adk"

/*
 * Provider-agnostic resilience wrapper around any BaseLlm.
 *
 * Two behaviours, in order:
 *   1. Retry the primary on transient failures (429 / 503 / RESOURCE_EXHAUSTED)
 *      with exponential backoff + full jitter, honouring a server-supplied
 *      Retry-After / retryDelay when present.
 *   2. On exhaustion, delegate once to `fallback` (a different provider) if
 *      one was supplied.
 *
 * Retry is only safe BEFORE the first yield. Once a response has been
 * emitted the agent has already observed partial output, so re-running the
 * request would duplicate text or re-fire tool calls. After first yield we
 * re-throw and let the run fail - see `yielded` below.
 *
 * Errors reach us in three different shapes (Anthropic SDK error objects,
 * adk-js Gemini errors, our own fetch-based adapter throwing `Error("... 429
 * ...")`), so classification sniffs status fields first and falls back to a
 * message regex.
 */

const MAX_ATTEMPTS = 4
const BASE_DELAY_MS = 500
const MAX_DELAY_MS = 20_000

export interface LlmErrorInfo {
  retryable: boolean
  status?: number
  retryAfterMs?: number
}

function readStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined
  const e = err as Record<string, unknown>
  for (const v of [e.status, e.statusCode, e.code]) {
    if (typeof v === "number") return v
  }
  const response = e.response as Record<string, unknown> | undefined
  if (typeof response?.status === "number") return response.status
  return undefined
}

/* Google returns `retryDelay: "37s"` inside error.details; Anthropic and most
 * HTTP proxies use a `retry-after` header in seconds. */
function readRetryAfterMs(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined
  const e = err as Record<string, unknown>
  const headers = e.headers as { get?: (k: string) => string | null } | undefined
  const header = headers?.get?.("retry-after")
  if (header) {
    const seconds = Number(header)
    if (Number.isFinite(seconds)) return seconds * 1000
  }
  const match = /"?retryDelay"?[:=]\s*"?(\d+(?:\.\d+)?)s/.exec(String(e.message ?? ""))
  if (match) return Number(match[1]) * 1000
  return undefined
}

const RETRYABLE_MESSAGE =
  /\b(429|503|500|RESOURCE_EXHAUSTED|UNAVAILABLE|rate.?limit|quota|overloaded|ECONNRESET|ETIMEDOUT)\b/i

export function classifyLlmError(err: unknown): LlmErrorInfo {
  const status = readStatus(err)
  const retryAfterMs = readRetryAfterMs(err)
  if (status !== undefined) {
    const retryable = status === 429 || status === 503 || status === 500 || status === 529
    return { retryable, status, retryAfterMs }
  }
  const message = err instanceof Error ? err.message : String(err)
  return { retryable: RETRYABLE_MESSAGE.test(message), retryAfterMs }
}

/* Full jitter (AWS architecture blog): sleep = random(0, min(cap, base*2^n)).
 * Uniform randomisation matters more than the growth curve here - several
 * agents in a pipeline hit the same quota at the same instant, and equal
 * backoff would just re-collide. */
function backoffMs(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs !== undefined) return Math.min(retryAfterMs, MAX_DELAY_MS)
  const ceiling = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt)
  return Math.random() * ceiling
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true },
    )
  })
}

export interface ResilientLlmOptions {
  primary: BaseLlm
  /** Different-provider LLM used once the primary exhausts its retries. Omit
   * when the request carries provider-native server tools (GOOGLE_SEARCH,
   * URL_CONTEXT) that another provider cannot service. */
  fallback?: BaseLlm
  /** Provider name, for log lines only. */
  label: string
  fallbackLabel?: string
}

export class ResilientLlm extends BaseLlm {
  private readonly primary: BaseLlm
  private readonly fallback?: BaseLlm
  private readonly label: string
  private readonly fallbackLabel?: string

  constructor({ primary, fallback, label, fallbackLabel }: ResilientLlmOptions) {
    super({ model: primary.model })
    this.primary = primary
    this.fallback = fallback
    this.label = label
    this.fallbackLabel = fallbackLabel
  }

  override async *generateContentAsync(
    llmRequest: LlmRequest,
    stream?: boolean,
    abortSignal?: AbortSignal,
  ): AsyncGenerator<LlmResponse, void> {
    let lastError: unknown

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let yielded = false
      try {
        for await (const response of this.primary.generateContentAsync(
          llmRequest,
          stream,
          abortSignal,
        )) {
          yielded = true
          yield response
        }
        return
      } catch (err) {
        lastError = err
        const { retryable, status, retryAfterMs } = classifyLlmError(err)
        if (yielded || !retryable || abortSignal?.aborted) throw err
        if (attempt === MAX_ATTEMPTS - 1) break

        const delay = backoffMs(attempt, retryAfterMs)
        console.warn(
          `[llm-retry] ${this.label} ${status ?? "error"} on ${this.model} - retry ${attempt + 1}/${MAX_ATTEMPTS - 1} in ${Math.round(delay)}ms`,
        )
        await sleep(delay, abortSignal)
      }
    }

    if (!this.fallback) throw lastError
    console.warn(
      `[llm-retry] ${this.label} exhausted on ${this.model} - falling back to ${this.fallbackLabel ?? "fallback"}`,
    )
    yield* this.fallback.generateContentAsync(llmRequest, stream, abortSignal)
  }

  /* Live bidi sessions are stateful and long-lived - retrying or swapping
   * providers mid-connection is not meaningful, so pass straight through. */
  override async connect(llmRequest: LlmRequest): Promise<BaseLlmConnection> {
    return this.primary.connect(llmRequest)
  }
}
