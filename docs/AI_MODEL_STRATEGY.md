# AI model strategy — reference

The single place that explains how SAFE picks, runs, and switches AI models —
what's decided, what's deferred, and what is *not possible* on the hosted
product. Read this before proposing a model change.

**Source plan:** `~/.claude/plans/safe-pluggable-ai-providers-ab.md`
("Pluggable AI providers + per-agent A/B"). That plan is **BUILT and
deployed** as of 2026-05-20. This doc is the plain-language summary +
the decisions that have shifted around it.

---

## 1. The goal

> **~90% of frontier accuracy at ~0–15% of current cost.**

The 0% floor is only reachable with local models in dev / a future desktop
build. The hosted SaaS floor is ~10–15% — a cheap-API floor, not free.

---

## 2. What shipped (the mechanism)

The pluggable-providers phase built the *mechanism* for switching models. It
did **not** switch any model. What's live in production now:

- **Five providers**: `gemini`, `anthropic`, `openrouter`, `ollama`, `mock`.
  `openrouter` + `ollama` share one OpenAI-compatible adapter
  (`lib/agents/runtime/openai-compatible-llm.ts`).
- **Per-agent provider/model** is a Firestore config field
  (`organizations/{orgId}/agentConfigs/{name}`), editable in Studio → select
  agent → **Tune** tab. A change takes effect on the agent's **next run** —
  no rebuild, no redeploy.
- **Run telemetry**: every `agentRuns` doc records the exact `provider` +
  `model`. The Studio **History** tab shows model / tokens / cost / latency
  per run.
- **Model-update tracking** (notify-only) — see §6.
- **Embeddings** hardened into an org-pinned, safely-switchable setting —
  see §7.

---

## 3. Model switching / migration — the part that is NOT done yet

Switching agents onto cheaper models is the **operational follow-up**, not a
build. It can begin any time; it was deliberately kept out of the build phase
("actually migrating any agent off Gemini/Anthropic" is a stated non-goal of
the plan — "a follow-up, decided by A/B results").

### How it works — prod-swap A/B

There is **no A/B sandbox** (it was cut as too heavy — see §8). A/B is done on
real runs:

1. Pick **one agent** at a time.
2. Swap its model in Studio → Tune. Effective next run.
3. Let it do real work. Compare the new model's runs against the prior
   model's in the History tab — cost and latency are objective; output
   quality is judged by a human via the existing review pipeline.
4. Keep `reviewer` + `human-gate` on **known-good models** while testing
   others — never degrade the safety net and the thing it checks at once.
   `drafter` is the safe first candidate *because* those gates protect it.
5. Decide per agent. Per-agent assignment is the **output** of A/B, not a
   pre-decision.

### Prerequisites before a serious migration

- **Gemini 3.5 Flash's exact API model ID is unconfirmed.** Released
  2026-05-19; verify the model string against the live Gemini API before
  wiring it. Do not guess.
- **The OpenRouter key is a free-tier key with a $5 cap.** Fine for a few
  A/B runs; it will run dry under real volume. Top it up before load-testing
  any OpenRouter agent.

---

## 4. Local AI models (Gemma 4, local Qwen) — dev / desktop ONLY

**This is the most-confused point. Read it carefully.**

Gemma 4 and other local open-weight models run through the **`ollama`
provider**, which talks to a model server on **`localhost`**.

**Cloud Run cannot reach `localhost`.** The hosted SaaS therefore *cannot*
run Gemma 4 or any Ollama model. This is not a config gap — it is
architectural. The `ollama` provider is **UI-gated**: it does not appear in
the provider dropdown on the hosted web build, only in local dev and (later)
the desktop app.

> "Switch all agents to Gemma 4" is **not possible on the hosted product.**
> Gemma 4 belongs to the desktop build (§5).

On hosted prod, the only swap candidates are `gemini` and `openrouter`
models (§9).

---

## 5. The desktop app (Electron) — future, gated on Phase 7

A desktop build is the *only* way local models (Gemma 4 etc.) become real,
because the desktop bundles a local server that **can** reach a local Ollama.

- **Shape**: Electron shell; `next build` with `output: 'standalone'`; the
  Electron main process boots the bundled Node server on localhost; the
  renderer loads it. A window-over-cloud desktop adds nothing — the bundled
  local server is the whole point.
- **Hard dependency: Phase 7.** A desktop app cannot ship Admin SDK
  credentials, so it must use the user-scoped client SDK + Firestore
  Security Rules — which Phase 7 builds. **Desktop cannot precede Phase 7.**
- **Online-only.** Cloud Firestore; offline/local datastore is deferred.
- Adds a model-manager UI (Gemma 4 26B Q4 ≈ 18 GB download) and flips the
  `ollama` provider's UI gate on.
- The hook is already in place: the `ollama` provider + adapter exist after
  this phase, so the desktop phase only adds the Electron wrapper.

**Sequencing:** pluggable providers (done) → Phase 7 (auth + Security Rules)
→ Electron desktop.

---

## 6. Model-update tracking — notify-only

A bi-weekly scheduled check (`functions/src/modelUpdateCheck.ts`) plus a
manual "check now" button in the Studio Model-updates card flags newer
provider models.

- It **only notifies.** Nothing is auto-applied — a new model is a
  behaviour change, not a patch. A human reviews a flagged model and applies
  it via the prod-swap A/B in §3.
- Per-org `aiConfig.notifyModelUpdates` toggle. Off = agents stay pinned,
  no notifications — full stability.

---

## 7. Embeddings — cloud, org-pinned, NOT localized

Embeddings deliberately stay cloud-based and are **not** part of the local-AI
story.

- The embedding model is an org-level setting (`aiConfig.embeddingModel`).
- Hard constraint: **768 dimensions** — the Firestore vector index is
  dimension-fixed. Only vetted 768-dim models may be selected.
- Currently only `gemini-embedding-001` has a wired adapter.
  `google/embeddinggemma-300m` is a candidate (768-dim native) but is **not
  adopted** — it carries the Gemma licence (not Apache 2.0) and needs
  redistribution vetting first.
- `retrieve()` filters stored vectors to the current model, so a collection
  mid-migration never cross-scores. Changing the model triggers an
  append-only re-embed migration (`firestore/seeds/0011_reembed_migration.ts`).

---

## 8. Decisions moved out / deferred / rejected

| Decision | Status | Why |
|---|---|---|
| A/B sandbox (synthetic side-by-side runs) | **Cut** | Too heavy to build; prod-swap + run telemetry replaces it. |
| Shadow-mode A/B (candidate model on every real run) | **Out** | Doubles cost on every run; not worth it. |
| Per-tenant bring-your-own-key | **Deferred** | One platform OpenRouter key for v1, cost folded into subscription. |
| Auto-applying model updates | **Out** | A new model is a behaviour change; humans apply after A/B. Tracking is notify-only. |
| Gemma 4 / local models on hosted prod | **Not possible** | Cloud Run can't reach a localhost model server. Desktop only (§5). |
| Electron desktop build | **Deferred** | Depends on Phase 7 (auth + Security Rules). |
| Localized / on-device embeddings | **Rejected** | Embeddings stay cloud + org-pinned (§7). |
| `openclaude` repo, HuggingFace, Docker | **Rejected** | Wrong tool category for this product. |

---

## 9. Model shortlist — exact IDs (do not invent)

Every model we intend to A/B, with its exact ID. **Do not substitute or
invent IDs.** Where marked *⚠️ confirm*, verify against the provider's live
API/docs before wiring; if it can't be confirmed, surface that — never guess.

### Generation models — hosted-prod-capable

| Model | Exact ID | Provider | Notes |
|---|---|---|---|
| Gemini 2.5 Flash | `gemini-2.5-flash` | gemini | In use — default for most agents |
| Gemini 2.5 Pro | `gemini-2.5-pro` | gemini | In use — reviewer / meta-config / cadence-planner |
| Gemini 3.5 Flash | `gemini-3.5-flash` *(⚠️ confirm)* | gemini | Primary Gemini upgrade target; exact ID unconfirmed |
| Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | anthropic | In use — current `drafter` |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | anthropic | Registry fallback |
| DeepSeek V4-flash | `deepseek/deepseek-v4-flash` *(⚠️ confirm slug)* | openrouter | Cheapest credible option |
| GLM-5.1 | `z-ai/glm-5.1` | openrouter | Strong open agentic model; MIT licence |
| Qwen3.6 Plus | `qwen/qwen3.6-plus` | openrouter | Hosted API-only (not open-weight) |

### Local open-weight models — `ollama` provider, dev/desktop ONLY (§4)

| Model | Ollama tag | Notes |
|---|---|---|
| Gemma 4 26B (MoE) | `gemma4:26b` | ~18 GB Q4; Apache 2.0; production-quality floor |
| Gemma 4 31B (dense) | `gemma4:31b` | ~20 GB Q4; Apache 2.0 |
| Gemma 4 E4B | `gemma4:e4b` | Laptop-class; weaker multi-turn tool use |
| Gemma 4 E2B | `gemma4:e2b` | Edge/mobile; weak tool use — fallback tier |
| Qwen3.6-27B (dense) | `qwen3.6:27b` *(⚠️ confirm tag)* | Apache 2.0 |
| Qwen3.6-35B-A3B (MoE) | `qwen3.6:35b-a3b` *(⚠️ confirm tag)* | Apache 2.0 |

### Embedding models — 768-dim only (§7)

| Model | Exact ID | Notes |
|---|---|---|
| Gemini embedding | `gemini-embedding-001` | In use; truncated to 768d |
| EmbeddingGemma | `google/embeddinggemma-300m` | Candidate, **not adopted** — Gemma licence, vet first |

---

## 10. Quick answers

- **"When do we switch all models to Gemini 3.5 Flash / Gemma 4?"** — The
  mechanism is live; the switch is a per-agent A/B you run whenever you like
  (§3). Gemini 3.5 Flash: confirm its ID first. Gemma 4: **not on hosted
  prod** — desktop only.
- **"Can we run everything local to hit 0% cost?"** — Only in dev or the
  future desktop app. The hosted SaaS floor is cheap-API, ~10–15%.
- **"Is a new model auto-adopted when it ships?"** — No. You're notified;
  you decide; you A/B.
