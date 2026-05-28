/*
 * ⚠️  HAND-MAINTAINED STATIC PRICE TABLE — NOT a live feed. ⚠️
 *
 * Used only to put an *estimated* USD cost next to a run in the prod-swap
 * A/B comparison view (§6.6 of safe-pluggable-ai-providers-ab.md). It is
 * NOT used for billing, quota, or anything load-bearing.
 *
 * Prices are USD per 1,000,000 tokens, list price, and WILL go stale.
 * When a model is added or a provider changes pricing, edit this file by
 * hand — confirm every number against the provider's pricing page first:
 *   - Gemini:     https://ai.google.dev/gemini-api/docs/pricing
 *   - Anthropic:  https://www.anthropic.com/pricing
 *   - OpenRouter: https://openrouter.ai/models  (per-model)
 * A model absent from this table simply shows no cost estimate — that is
 * the intended, safe degradation. Never guess a number to fill a gap.
 *
 * Keys are the exact model IDs from the plan's §4 shortlist.
 */

export interface ModelPrice {
  /** USD per 1M input/prompt tokens. */
  inputPer1M: number
  /** USD per 1M output/completion tokens. */
  outputPer1M: number
}

/* Ollama (local) models are free to run — no API cost. They are
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

  // --- OpenRouter open models (verify per-model on openrouter.ai) ---
  "z-ai/glm-5.1": { inputPer1M: 0.2, outputPer1M: 0.6 },
  "qwen/qwen3.6-plus": { inputPer1M: 0.4, outputPer1M: 1.2 },
  // deepseek/deepseek-v4-flash: slug + price unconfirmed — omitted.
}

/**
 * Estimate the USD cost of a run from its token counts. Returns 0 for any
 * model not in the table (local Ollama models, or a model whose price
 * hasn't been entered yet) — the UI then shows no estimate rather than a
 * wrong one.
 */
export function estimateUsdCost(
  model: string | null | undefined,
  promptTokens: number,
  completionTokens: number,
): number {
  if (!model) return 0
  const price = MODEL_PRICES[model]
  if (!price) return 0
  return (
    (promptTokens / 1_000_000) * price.inputPer1M +
    (completionTokens / 1_000_000) * price.outputPer1M
  )
}

/** Whether a model has a price entry — lets the UI distinguish "free /
 *  local" from "price not yet recorded". */
export function hasPrice(model: string | null | undefined): boolean {
  return !!model && model in MODEL_PRICES
}
