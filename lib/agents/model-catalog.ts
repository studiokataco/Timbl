import type { AgentProvider } from "@/lib/schemas/agentConfig"

/*
 * Model-catalog logic for the notify-only model-update check (§6.8).
 *
 * Fetches each provider's live model list and diffs it against the models
 * we already know about (the §4 shortlist + whatever is configured on
 * agentConfigs). "Newer" detection is deliberately SIMPLE - version-string
 * parsing is brittle, so we never auto-rank or claim "this is the newest".
 * We only flag a live model when:
 *   1. it isn't already known, AND
 *   2. it shares a family (vendor + model-name stem) with a known model.
 * That surfaces "a newer GLM exists" without drowning the operator in the
 * 300+ unrelated models OpenRouter lists. A human decides what to do.
 *
 * Server-only - reads provider API keys from env.
 */

export interface CatalogModel {
  provider: AgentProvider
  id: string
}

/** Vendor + non-numeric stem of a model id - the "family" used to decide
 *  whether an unknown model is a newer relative of one we use.
 *  `z-ai/glm-5.1` → `z-ai/glm`; `gemini-3.5-flash` → `gemini`. */
export function familyOf(id: string): string {
  const slash = id.indexOf("/")
  const vendor = slash >= 0 ? id.slice(0, slash) : ""
  const rest = slash >= 0 ? id.slice(slash + 1) : id
  const stem = (rest.match(/^[^\d]*/)?.[0] ?? rest)
    .replace(/[-.:]+$/, "")
    .toLowerCase()
  return vendor ? `${vendor}/${stem}` : stem
}

function dedupe(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))]
}

function readGeminiKey(): string | undefined {
  return (
    process.env.GOOGLE_GENAI_API_KEY ??
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY
  )
}

async function fetchOpenRouterModels(): Promise<string[]> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models")
    if (!res.ok) return []
    const json = (await res.json()) as { data?: Array<{ id?: string }> }
    return dedupe((json.data ?? []).map((m) => m.id ?? ""))
  } catch {
    return []
  }
}

async function fetchAnthropicModels(): Promise<string[]> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return []
  try {
    const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    })
    if (!res.ok) return []
    const json = (await res.json()) as { data?: Array<{ id?: string }> }
    return dedupe((json.data ?? []).map((m) => m.id ?? ""))
  } catch {
    return []
  }
}

async function fetchGeminiModels(): Promise<string[]> {
  const key = readGeminiKey()
  if (!key) return []
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=200`,
    )
    if (!res.ok) return []
    const json = (await res.json()) as { models?: Array<{ name?: string }> }
    return dedupe(
      (json.models ?? []).map((m) => (m.name ?? "").replace(/^models\//, "")),
    )
  } catch {
    return []
  }
}

/** Every provider's live generation-model list. Ollama is dev/desktop only
 *  (its `/api/tags` reflects locally-pulled models) and is not polled here. */
export async function fetchProviderModels(): Promise<CatalogModel[]> {
  const [openrouter, anthropic, gemini] = await Promise.all([
    fetchOpenRouterModels(),
    fetchAnthropicModels(),
    fetchGeminiModels(),
  ])
  return [
    ...openrouter.map((id) => ({ provider: "openrouter" as const, id })),
    ...anthropic.map((id) => ({ provider: "anthropic" as const, id })),
    ...gemini.map((id) => ({ provider: "gemini" as const, id })),
  ]
}

/**
 * Diff a live model list against the known set. Returns the live models
 * that are NOT known but DO belong to a known family - i.e. plausible
 * newer versions of something we care about. Never ranked.
 */
export function diffNewModels(
  live: CatalogModel[],
  knownIds: Iterable<string>,
): CatalogModel[] {
  const known = new Set<string>()
  const knownFamilies = new Set<string>()
  for (const id of knownIds) {
    known.add(id)
    knownFamilies.add(familyOf(id))
  }
  return live.filter(
    (m) => !known.has(m.id) && knownFamilies.has(familyOf(m.id)),
  )
}
