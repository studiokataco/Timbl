import "server-only"

/*
 * Server-only OpenRouter account + billing reads for the control centre.
 * The management key (OPENROUTER_API_KEY) is platform-admin-only and never
 * leaves the server - callers must already be behind requirePlatformAdmin.
 *
 * Three surfaces, all bearer-authed against the same key:
 *   - GET /credits     purchased vs used totals (account lifetime)
 *   - GET /key         this key's usage + spend limit + remaining headroom
 *   - GET /generation  exact per-request cost, used to reconcile a run's
 *                      estimated cost against the authoritative number.
 */

const OPENROUTER_API = "https://openrouter.ai/api/v1"

function readKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY
}

async function orFetch<T>(path: string): Promise<T | null> {
  const key = readKey()
  if (!key) return null
  try {
    const res = await fetch(`${OPENROUTER_API}${path}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: T }
    return json.data ?? null
  } catch {
    return null
  }
}

export interface OpenRouterAccount {
  /** USD spent against this key's tracked usage. */
  usage: number
  /** Spend limit on the key, or null for unlimited. */
  limit: number | null
  /** Remaining spend headroom, or null for unlimited. */
  limitRemaining: number | null
  /** Lifetime purchased credits on the account. */
  totalCredits: number
  /** Lifetime usage against the account. */
  totalUsage: number
  /** totalCredits - totalUsage; what's actually left to spend. */
  remaining: number
  isFreeTier: boolean
}

interface KeyData {
  usage?: number
  limit?: number | null
  limit_remaining?: number | null
  is_free_tier?: boolean
}

interface CreditsData {
  total_credits?: number
  total_usage?: number
}

/** Live account snapshot, or null when no key is configured / API unreachable. */
export async function getOpenRouterAccount(): Promise<OpenRouterAccount | null> {
  if (!readKey()) return null
  const [key, credits] = await Promise.all([
    orFetch<KeyData>("/key"),
    orFetch<CreditsData>("/credits"),
  ])
  if (!key && !credits) return null
  const totalCredits = credits?.total_credits ?? 0
  const totalUsage = credits?.total_usage ?? 0
  return {
    usage: key?.usage ?? 0,
    limit: key?.limit ?? null,
    limitRemaining: key?.limit_remaining ?? null,
    totalCredits,
    totalUsage,
    remaining: totalCredits - totalUsage,
    isFreeTier: key?.is_free_tier ?? false,
  }
}

interface GenerationData {
  total_cost?: number
  tokens_prompt?: number
  tokens_completion?: number
  native_tokens_prompt?: number
  native_tokens_completion?: number
}

export interface GenerationCost {
  totalCost: number
  promptTokens: number
  completionTokens: number
}

/*
 * Exact cost for one generation id. Returns null while the cost is still
 * settling (OpenRouter resolves cost a short moment after the stream ends, so
 * an immediate read can 404) or when the id is unknown - callers retry later.
 */
export async function fetchGenerationCost(
  id: string,
): Promise<GenerationCost | null> {
  const data = await orFetch<GenerationData>(
    `/generation?id=${encodeURIComponent(id)}`,
  )
  if (!data || typeof data.total_cost !== "number") return null
  return {
    totalCost: data.total_cost,
    promptTokens: data.native_tokens_prompt ?? data.tokens_prompt ?? 0,
    completionTokens:
      data.native_tokens_completion ?? data.tokens_completion ?? 0,
  }
}
