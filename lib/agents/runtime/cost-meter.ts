import type { Context, LlmResponse } from "@google/adk"

import { estimateUsdCost } from "../pricing"
import { RUNTIME_STATE_KEY } from "./context"

/*
 * Run-scoped spend meter. Every LLM call a run makes - every sub-agent in a
 * pipeline, a cross-provider fallback, the quality finisher - lands on the
 * same meter, keyed by runId, so the run's cap and its recorded cost cover
 * the whole run rather than one agent's slice of it.
 *
 * OpenRouter calls carry an exact `providerCostUsd` (web search and reasoning
 * included); everything else falls back to the static price table. The cap is
 * checked BEFORE each call against that call's worst case, so the call that
 * would cross it is refused instead of completing and overshooting.
 *
 * Lives in process memory: the run and its terminal markAgentRunStatus share
 * a process. Entries a crashed run never closes are swept after STALE_MS.
 */

export interface RunMeter {
  runId: string
  capUsd: number
  usdCost: number
  exactCalls: number
  estimatedCalls: number
  llmCalls: number
  promptTokens: number
  completionTokens: number
  cachedTokens: number
  reasoningTokens: number
  openedAt: number
}

export type CostSource = "provider" | "estimate" | "mixed"

const STALE_MS = 2 * 60 * 60 * 1000
const meters = new Map<string, RunMeter>()

function sweep(now: number): void {
  for (const [id, m] of meters) {
    if (now - m.openedAt > STALE_MS) meters.delete(id)
  }
}

export function openRunMeter(runId: string, capUsd = Infinity): RunMeter {
  const now = Date.now()
  sweep(now)
  const existing = meters.get(runId)
  if (existing) {
    existing.capUsd = Math.min(existing.capUsd, capUsd)
    return existing
  }
  const meter: RunMeter = {
    runId,
    capUsd,
    usdCost: 0,
    exactCalls: 0,
    estimatedCalls: 0,
    llmCalls: 0,
    promptTokens: 0,
    completionTokens: 0,
    cachedTokens: 0,
    reasoningTokens: 0,
    openedAt: now,
  }
  meters.set(runId, meter)
  return meter
}

export function closeRunMeter(runId: string): RunMeter | undefined {
  const meter = meters.get(runId)
  meters.delete(runId)
  return meter
}

export function costSourceOf(meter: RunMeter): CostSource {
  if (meter.estimatedCalls === 0) return "provider"
  if (meter.exactCalls === 0) return "estimate"
  return "mixed"
}

export function runIdFromContext(context: Context | undefined): string | undefined {
  const raw = context?.state.get(RUNTIME_STATE_KEY) as { runId?: string } | undefined
  return raw?.runId
}

/** Meter for the run this callback belongs to, opened lazily for paths that
 * did not open one (resume, tests). Undefined outside a seeded session. */
export function meterForContext(context: Context | undefined): RunMeter | undefined {
  const runId = runIdFromContext(context)
  return runId ? openRunMeter(runId) : undefined
}

export interface CallUsage {
  model: string
  promptTokens: number
  completionTokens: number
  cachedTokens: number
  reasoningTokens: number
  providerCostUsd?: number
}

export function usageFromResponse(
  model: string,
  response: LlmResponse,
): CallUsage | undefined {
  const usage = response.usageMetadata as
    | {
        promptTokenCount?: number
        candidatesTokenCount?: number
        cachedContentTokenCount?: number
        thoughtsTokenCount?: number
      }
    | undefined
  if (!usage) return undefined
  const cost = (response.customMetadata as { providerCostUsd?: unknown } | undefined)
    ?.providerCostUsd
  return {
    model,
    promptTokens: usage.promptTokenCount ?? 0,
    completionTokens: usage.candidatesTokenCount ?? 0,
    cachedTokens: usage.cachedContentTokenCount ?? 0,
    reasoningTokens: usage.thoughtsTokenCount ?? 0,
    ...(typeof cost === "number" ? { providerCostUsd: cost } : {}),
  }
}

export function callUsd(call: CallUsage): number {
  return call.providerCostUsd !== undefined
    ? call.providerCostUsd
    : estimateUsdCost(call.model, call.promptTokens, call.completionTokens, call.cachedTokens)
}

/** Adds one call to the meter and returns what it cost. */
export function recordCall(meter: RunMeter, call: CallUsage): number {
  const exact = call.providerCostUsd !== undefined
  const usd = callUsd(call)
  meter.usdCost += usd
  meter.llmCalls += 1
  meter.promptTokens += call.promptTokens
  meter.completionTokens += call.completionTokens
  meter.cachedTokens += call.cachedTokens
  meter.reasoningTokens += call.reasoningTokens
  if (exact) meter.exactCalls += 1
  else meter.estimatedCalls += 1
  return usd
}

/* Characters per token for a pre-call prompt size guess. Deliberately low so
 * the guess runs high: the check exists to refuse, not to bill. */
const CHARS_PER_TOKEN = 3

export function estimatePromptTokens(payload: unknown): number {
  try {
    return Math.ceil(JSON.stringify(payload ?? "").length / CHARS_PER_TOKEN)
  } catch {
    return 0
  }
}

/** Worst case for one call: full prompt at the input rate plus the whole
 * output ceiling at the output rate. Zero for models with no price entry. */
export function worstCaseUsd(model: string, promptTokens: number, maxOutputTokens: number): number {
  return estimateUsdCost(model, promptTokens, maxOutputTokens)
}
