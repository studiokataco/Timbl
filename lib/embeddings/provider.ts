import { createHash } from "node:crypto"

/*
 * Single-function provider abstraction. embed(text) returns a vector + the
 * dim + the model name. The model name lives on every embedded doc so we
 * can tell at a glance which generation produced it (and reject mismatches
 * at query time if we ever care).
 *
 * Resolution order (first match wins):
 *   1. AGENT_MOCK_LLM=1 → mock, regardless of EMBEDDING_PROVIDER.
 *   2. EMBEDDING_PROVIDER explicit (gemini | voyage | openai | mock).
 *   3. First provider key present: GEMINI_API_KEY (or GOOGLE_API_KEY) →
 *      gemini; VOYAGE_API_KEY → voyage; OPENAI_API_KEY → openai.
 *   4. Mock (with a one-time warn).
 *
 * SET EMBEDDING_PROVIDER EXPLICITLY IN ANY DEPLOYED ENVIRONMENT. Step 3 is a
 * dev convenience that is actively dangerous in production: the embedding
 * model is stamped on every stored vector and retrieve() filters to the
 * current model, so an unrelated env change that adds or removes a provider
 * key silently re-points the corpus and retrieval starts returning nothing.
 * Step 3 warns loudly for that reason.
 *
 * Embedding traffic reads EMBEDDING_API_KEY before the shared Gemini keys so
 * it can be pointed at its own credential (and therefore its own quota).
 * Sharing one key with the agent runtime meant a burst of agent runs could
 * exhaust the quota that retrieval depends on.
 *
 * Real adapters are ~15 LOC each - one fetch against the provider's
 * embeddings endpoint. If a call throws, we re-throw so callers can decide;
 * the action-layer wrapper (embedIfChanged) turns it into a soft-fail.
 */

export type EmbedResult = { vector: number[]; dim: number; model: string }

type ProviderName = "gemini" | "voyage" | "openai" | "mock"

const warnedKeys = new Set<string>()
function warnOnce(key: string, message: string) {
  if (warnedKeys.has(key)) return
  warnedKeys.add(key)
  console.warn(message)
}

function readGeminiKey(): string | undefined {
  return (
    process.env.EMBEDDING_API_KEY ??
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENAI_API_KEY ??
    process.env.GOOGLE_API_KEY
  )
}

function inferProvider(): ProviderName {
  if (readGeminiKey()) return "gemini"
  if (process.env.VOYAGE_API_KEY) return "voyage"
  if (process.env.OPENAI_API_KEY) return "openai"
  return "mock"
}

function resolveProvider(): ProviderName {
  if (process.env.AGENT_MOCK_LLM === "1") return "mock"
  const explicit = process.env.EMBEDDING_PROVIDER?.toLowerCase()
  if (explicit === "gemini" || explicit === "voyage" || explicit === "openai" || explicit === "mock") {
    return explicit
  }
  if (explicit) {
    throw new Error(
      `[embed] EMBEDDING_PROVIDER="${explicit}" is not one of gemini | voyage | openai | mock. ` +
        "Refusing to infer - a wrong embedding model invalidates the stored corpus.",
    )
  }

  const inferred = inferProvider()
  warnOnce(
    `embed-inferred-${inferred}`,
    inferred === "mock"
      ? "[embed] No embedding provider key set - using deterministic mock. Set EMBEDDING_PROVIDER + EMBEDDING_API_KEY."
      : `[embed] EMBEDDING_PROVIDER not set - inferred "${inferred}" from available keys. ` +
          "Set it explicitly; inference re-points the corpus whenever provider keys change.",
  )
  return inferred
}

export async function embed(text: string): Promise<EmbedResult> {
  const provider = resolveProvider()
  switch (provider) {
    case "gemini":
      return embedGemini(text)
    case "voyage":
      return embedVoyage(text)
    case "openai":
      return embedOpenAI(text)
    case "mock":
      return embedMock(text)
  }
}

/*
 * The model string embed() will stamp on a vector right now, derived from
 * the same resolution as embed() but WITHOUT making a network call.
 *
 * Two consumers need this:
 *   - embedIfChanged() re-embeds when a stored vector's model no longer
 *     matches (model switch, not just a text edit).
 *   - retrieve() filters stored vectors to the current model so a
 *     mixed-model collection never cross-scores (§6.7).
 *
 * Keeping this in lockstep with resolveProvider() is the contract - if a
 * new provider branch is added to embed(), add it here too.
 */
export function currentEmbeddingModel(): string {
  switch (resolveProvider()) {
    case "gemini":
      return GEMINI_MODEL
    case "voyage":
      return VOYAGE_MODEL
    case "openai":
      return OPENAI_MODEL
    case "mock":
      return MOCK_MODEL
  }
}

/* ── Gemini ─────────────────────────────────────────────────────────── */

const GEMINI_MODEL = "gemini-embedding-001"
/*
 * Gemini's default output is 3072d, but Firestore native vector indexes cap
 * at 2048. Request Matryoshka truncation to 768d - Google's recommended
 * storage size - so the same vectors work in the emulator (brute-force
 * cosine) and in Phase 7+ (native findNearest).
 *
 * If you change this, also bump `dimension` in firestore.indexes.json for
 * every embedding.vector entry and re-run the embeddings backfill.
 */
const GEMINI_OUTPUT_DIM = 768

async function embedGemini(text: string): Promise<EmbedResult> {
  const key = readGeminiKey()
  if (!key) throw new Error("[embed:gemini] No EMBEDDING_API_KEY / Gemini key in env")
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:embedContent?key=${key}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      outputDimensionality: GEMINI_OUTPUT_DIM,
    }),
  })
  if (!res.ok) throw new Error(`[embed:gemini] ${res.status} ${await res.text()}`)
  const json = (await res.json()) as { embedding?: { values?: number[] } }
  const vector = json.embedding?.values
  if (!vector?.length) throw new Error("[embed:gemini] empty embedding")
  return { vector, dim: vector.length, model: GEMINI_MODEL }
}

/* ── Voyage ─────────────────────────────────────────────────────────── */

const VOYAGE_MODEL = "voyage-3-lite"

async function embedVoyage(text: string): Promise<EmbedResult> {
  const key = process.env.VOYAGE_API_KEY
  if (!key) throw new Error("[embed:voyage] VOYAGE_API_KEY not set")
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ input: text, model: VOYAGE_MODEL }),
  })
  if (!res.ok) throw new Error(`[embed:voyage] ${res.status} ${await res.text()}`)
  const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> }
  const vector = json.data?.[0]?.embedding
  if (!vector?.length) throw new Error("[embed:voyage] empty embedding")
  return { vector, dim: vector.length, model: VOYAGE_MODEL }
}

/* ── OpenAI ─────────────────────────────────────────────────────────── */

const OPENAI_MODEL = "text-embedding-3-small"

async function embedOpenAI(text: string): Promise<EmbedResult> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error("[embed:openai] OPENAI_API_KEY not set")
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ input: text, model: OPENAI_MODEL }),
  })
  if (!res.ok) throw new Error(`[embed:openai] ${res.status} ${await res.text()}`)
  const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> }
  const vector = json.data?.[0]?.embedding
  if (!vector?.length) throw new Error("[embed:openai] empty embedding")
  return { vector, dim: vector.length, model: OPENAI_MODEL }
}

/* ── Mock (deterministic) ───────────────────────────────────────────── */

const MOCK_DIM = 64
const MOCK_MODEL = "mock-sha1-64"

/*
 * Deterministic mock: hash text → seed → 64 floats in [-1, 1] → unit-normalize.
 * Same text always yields the same vector, so cosine self-similarity is 1.0
 * and the backfill is stable across re-runs without any provider call.
 */
function embedMock(text: string): EmbedResult {
  const seed = createHash("sha256").update(text).digest()
  const vector = new Array<number>(MOCK_DIM)
  // Two bytes per dimension → uniform-ish int → centered [-1, 1].
  for (let i = 0; i < MOCK_DIM; i++) {
    const hi = seed[(i * 2) % seed.length]
    const lo = seed[(i * 2 + 1) % seed.length]
    const u = ((hi << 8) | lo) / 0xffff
    vector[i] = u * 2 - 1
  }
  let norm = 0
  for (const v of vector) norm += v * v
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < MOCK_DIM; i++) vector[i] /= norm
  return { vector, dim: MOCK_DIM, model: MOCK_MODEL }
}
