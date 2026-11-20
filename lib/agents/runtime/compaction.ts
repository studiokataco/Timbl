import {
  LlmSummarizer,
  isCompactedEvent,
  type BaseContextCompactor,
  type BaseLlm,
  type BaseSummarizer,
  type Event,
  type InvocationContext,
} from "@google/adk"

import type { AgentConfig } from "@/lib/schemas/agentConfig"

import { detectLlmStatus, resolveLlm } from "./llm-registry"

/*
 * Context compaction wiring for LlmAgents (see build-agent.ts).
 *
 * Compaction exists to cap what a long run re-sends, but every compaction
 * also rewrites the head of the history, and that ends the provider's prompt
 * cache right after the system prompt: every later token bills at the full
 * input rate (and on newer OpenAI models the rewrite pays a cache write on
 * top). So compaction must be rare, and the prefix it leaves must stay
 * stable for as many calls as possible.
 *
 * ADK's TokenBasedContextCompactor gets both wrong. It sizes each model
 * event by its usageMetadata.promptTokenCount - the WHOLE prompt of that
 * call - and sums those, so any run past eventRetentionSize events reads as
 * far over threshold and compacts before nearly every call. It also keeps a
 * fixed event count, so a few large tool results (web search, listPosts)
 * stay over threshold even right after compacting. Both showed up in the
 * OpenRouter activity log as 30-48k-token Sol calls with only the ~6k system
 * prefix cached.
 *
 * This compactor sizes events by their content, retains the newest events by
 * token budget, and compacts down to RETAIN_FRACTION of the threshold, so a
 * run gets several calls of headroom - each one a cache hit on the prefix -
 * before the next compaction.
 *
 * The summariser always uses the cheapest reachable model; the summary never
 * ships to a user.
 */

const SUMMARIZER_MODEL_OPENROUTER = "google/gemini-3.1-flash-lite"
const SUMMARIZER_MODEL_GEMINI = "gemini-2.5-flash"

/* What survives a compaction, as a share of the threshold. The rest is room
 * to grow on a stable, cached prefix before compacting again. */
const RETAIN_FRACTION = 0.4

/* Compacting fewer events than this rewrites the prefix for almost no
 * saving. */
const MIN_EVENTS_TO_COMPACT = 2

const CHARS_PER_TOKEN = 4

function resolveSummarizerLlm(config: AgentConfig): BaseLlm | undefined {
  /* Tests / verifications run against MockLlm; summarising there would emit
   * canned junk into the history. Skip compaction entirely in that mode. */
  if (process.env.AGENT_MOCK_LLM === "1") return undefined

  const status = detectLlmStatus()
  const llm = status.openrouter
    ? resolveLlm({ provider: "openrouter", model: SUMMARIZER_MODEL_OPENROUTER })
    : status.gemini
      ? resolveLlm({ provider: "gemini", model: SUMMARIZER_MODEL_GEMINI })
      : resolveLlm({ provider: config.provider, model: config.model })

  // resolveLlm returns a model-name string only for paths we don't take here;
  // a string can't summarise, so treat it as "no summariser available".
  return typeof llm === "string" ? undefined : llm
}

export function eventTokens(event: Event): number {
  if (isCompactedEvent(event)) {
    return Math.ceil(event.compactedContent.length / CHARS_PER_TOKEN)
  }
  let chars = 0
  for (const part of event.content?.parts ?? []) {
    if (part.text) chars += part.text.length
    if (part.functionCall) chars += JSON.stringify(part.functionCall.args ?? {}).length + 64
    if (part.functionResponse) {
      chars += JSON.stringify(part.functionResponse.response ?? {}).length + 64
    }
  }
  return Math.ceil(chars / CHARS_PER_TOKEN)
}

function hasFunctionCall(event: Event): boolean {
  return !!event.content?.parts?.some((p) => p.functionCall !== undefined)
}

function hasFunctionResponse(event: Event): boolean {
  return !!event.content?.parts?.some((p) => p.functionResponse !== undefined)
}

/** The events the next model call will actually see: the latest summary and
 * every raw event after it. */
export function activeEvents(events: Event[]): Event[] {
  let latest: Event | undefined
  for (const e of events) {
    if (isCompactedEvent(e) && (!latest || e.endTime > (latest as typeof e).endTime)) latest = e
  }
  if (!latest || !isCompactedEvent(latest)) return events
  const cutoff = latest.endTime
  return [latest, ...events.filter((e) => !isCompactedEvent(e) && e.timestamp > cutoff)]
}

/** Index of the first raw event to keep: the newest events that fit the
 * retain budget, never splitting a function call from its response. */
export function retainStartIndex(raw: Event[], retainBudget: number, maxRetained: number): number {
  let start = raw.length
  let used = 0
  while (start > 0 && raw.length - start < maxRetained) {
    const size = eventTokens(raw[start - 1])
    if (start < raw.length && used + size > retainBudget) break
    used += size
    start--
  }
  while (start > 0 && start < raw.length && hasFunctionResponse(raw[start]) && hasFunctionCall(raw[start - 1])) {
    start--
  }
  return start
}

export class StablePrefixCompactor implements BaseContextCompactor {
  constructor(
    private readonly opts: {
      tokenThreshold: number
      maxRetainedEvents: number
      summarizer: BaseSummarizer
    },
  ) {}

  private plan(events: Event[]) {
    const active = activeEvents(events)
    const summary = active.find(isCompactedEvent)
    const raw = active.filter((e) => !isCompactedEvent(e))
    const total = active.reduce((sum, e) => sum + eventTokens(e), 0)
    const start = retainStartIndex(
      raw,
      Math.floor(this.opts.tokenThreshold * RETAIN_FRACTION),
      this.opts.maxRetainedEvents,
    )
    return { summary, raw, total, start }
  }

  shouldCompact(invocationContext: InvocationContext): boolean {
    const { total, start } = this.plan(invocationContext.session.events)
    return total > this.opts.tokenThreshold && start >= MIN_EVENTS_TO_COMPACT
  }

  async compact(invocationContext: InvocationContext): Promise<void> {
    const { summary, raw, total, start } = this.plan(invocationContext.session.events)
    if (total <= this.opts.tokenThreshold || start < MIN_EVENTS_TO_COMPACT) return
    const toCompact = summary ? [summary, ...raw.slice(0, start)] : raw.slice(0, start)
    const compacted = await this.opts.summarizer.summarize(toCompact)
    if (!compacted.actions) {
      compacted.actions = {
        stateDelta: {},
        artifactDelta: {},
        requestedAuthConfigs: {},
        requestedToolConfirmations: {},
      }
    }
    invocationContext.session.events.push(compacted)
  }
}

export function makeContextCompactors(
  config: AgentConfig,
): BaseContextCompactor[] | undefined {
  if (!config.compaction.enabled) return undefined
  const summarizer = resolveSummarizerLlm(config)
  if (!summarizer) return undefined

  return [
    new StablePrefixCompactor({
      tokenThreshold: config.compaction.tokenThreshold,
      maxRetainedEvents: config.compaction.eventRetentionSize,
      summarizer: new LlmSummarizer({ llm: summarizer }),
    }),
  ]
}
