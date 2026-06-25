/*
 * ⚠️  HAND-MAINTAINED STATIC PRICE TABLE - NOT a live feed. ⚠️
 *
 * Used only to put an *estimated* USD cost next to a run in the prod-swap
 * A/B comparison view (§6.6 of safe-pluggable-ai-providers-ab.md). It is
 * NOT used for billing, quota, or anything load-bearing.
 *
 * Prices are USD per 1,000,000 tokens, list price, and WILL go stale.
 * When a model is added or a provider changes pricing, edit this file by
 * hand - confirm every number against the provider's pricing page first:
 *   - Gemini:     https://ai.google.dev/gemini-api/docs/pricing
 *   - Anthropic:  https://www.anthropic.com/pricing
 *   - OpenRouter: https://openrouter.ai/models  (per-model)
 * A model absent from this table simply shows no cost estimate - that is
 * the intended, safe degradation. Never guess a number to fill a gap.
 *
 * Keys are the exact model IDs agents are configured with. The estimate is
 * the fast first number; for OpenRouter runs an exact cost is reconciled
 * later from the generation id (metrics.actualUsdCost) and is authoritative.
 */

export interface ModelPrice {
  /** USD per 1M input/prompt tokens. */
  inputPer1M: number
  /** USD per 1M output/completion tokens. */
  outputPer1M: number
}

/* Ollama (local) models are free to run - no API cost. They are
 * intentionally omitted; estimateUsdCost() returns 0 for an unknown model
 * and that is correct for them. */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  // --- Gemini (verify against ai.google.dev/gemini-api/docs/pricing) ---
  "gemini-2.5-flash": { inputPer1M: 0.3, outputPer1M: 2.5 },
  "gemini-2.5-pro": { inputPer1M: 1.25, outputPer1M: 10 },
  "gemini-3.5-flash": { inputPer1M: 1.5, outputPer1M: 9 },

  // --- Anthropic (verify against anthropic.com/pricing) ---
  "claude-haiku-4-5-20251001": { inputPer1M: 1, outputPer1M: 5 },
  "claude-sonnet-4-6": { inputPer1M: 3, outputPer1M: 15 },

  // --- OpenRouter ladder (LIST price, verify per-model on openrouter.ai) ---
  // Seed LIST rates only - promo rates (e.g. minimax-m3's temporary 50% off)
  // would make estimates silently double when the promo ends.
  "google/gemini-3.1-flash-lite": { inputPer1M: 0.25, outputPer1M: 1.5 },
  "minimax/minimax-m3": { inputPer1M: 0.6, outputPer1M: 2.4 },
  "anthropic/claude-haiku-4.5": { inputPer1M: 1, outputPer1M: 5 },
  "z-ai/glm-5.2": { inputPer1M: 1.1, outputPer1M: 3.5 },
}

/* Prompt-cache reads are billed at ~0.1x the input rate across providers
 * (Anthropic ephemeral, Gemini implicit). `cachedTokens` is the slice of
 * `promptTokens` that was served from cache; we bill it at the discounted
 * rate and the remainder at full rate. Cache WRITES (~1.25x) are folded into
 * full-rate prompt tokens - close enough for a non-billing estimate. */
const CACHE_READ_DISCOUNT = 0.1

/**
 * Estimate the USD cost of a run from its token counts. Returns 0 for any
 * model not in the table (local Ollama models, or a model whose price
 * hasn't been entered yet) - the UI then shows no estimate rather than a
 * wrong one.
 */
export function estimateUsdCost(
  model: string | null | undefined,
  promptTokens: number,
  completionTokens: number,
  cachedTokens = 0,
): number {
  if (!model) return 0
  const price = MODEL_PRICES[model]
  if (!price) return 0
  const cached = Math.min(Math.max(cachedTokens, 0), promptTokens)
  const fullRateInput = promptTokens - cached
  return (
    (fullRateInput / 1_000_000) * price.inputPer1M +
    (cached / 1_000_000) * price.inputPer1M * CACHE_READ_DISCOUNT +
    (completionTokens / 1_000_000) * price.outputPer1M
  )
}

/** Whether a model has a price entry - lets the UI distinguish "free /
 *  local" from "price not yet recorded". */
export function hasPrice(model: string | null | undefined): boolean {
  return !!model && model in MODEL_PRICES
}
