import type { AgentProvider } from "@/lib/schemas/agentConfig"

/*
 * Provider UI catalog - suggested model IDs per provider and the
 * local-AI availability gate. Client-safe: reads only NEXT_PUBLIC_* and
 * NODE_ENV so it can be imported into client components.
 *
 * OpenRouter ids follow the agent model ladder (cheap / workhorse / review /
 * escalation). These are *suggestions* surfaced in a free-text <datalist> -
 * the model field stays z.string(), so an operator can always type an ID not
 * listed here.
 */

/* Human-readable names for the model picker. Curated for the ids we
 * ship; anything else falls back to `prettifyModelId`. */
const MODEL_LABELS: Record<string, string> = {
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-pro": "Gemini 2.5 Pro",
  "gemini-3.5-flash": "Gemini 3.5 Flash",
  "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
  "claude-sonnet-4-6": "Claude Sonnet 4.6",
  "google/gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite",
  "minimax/minimax-m3": "MiniMax M3",
  "anthropic/claude-haiku-4.5": "Claude Haiku 4.5",
  "z-ai/glm-5.2": "GLM 5.2",
  mock: "Mock",
}

function prettifyModelId(id: string): string {
  const noVendor = id.includes("/") ? id.slice(id.indexOf("/") + 1) : id
  const noDate = noVendor.replace(/-\d{6,}$/, "")
  return noDate
    .split(/[-_:.]/)
    .filter(Boolean)
    .map((w) => (/^\d/.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ")
}

/** Display name for a model id (e.g. `gemini-3.5-flash` -> `Gemini 3.5 Flash`). */
export function modelLabel(id: string): string {
  return MODEL_LABELS[id] ?? prettifyModelId(id)
}

/** Suggested model IDs per provider (datalist hints - not an allowlist). */
export const MODEL_SUGGESTIONS: Record<AgentProvider, readonly string[]> = {
  gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-3.5-flash"],
  anthropic: ["claude-haiku-4-5-20251001", "claude-sonnet-4-6"],
  openrouter: [
    "google/gemini-3.1-flash-lite",
    "minimax/minimax-m3",
    "anthropic/claude-haiku-4.5",
    "z-ai/glm-5.2",
  ],
  ollama: [
    "gemma4:26b",
    "gemma4:31b",
    "gemma4:e4b",
    "gemma4:e2b",
    "qwen3.6:27b",
    "qwen3.6:35b-a3b",
  ],
  mock: ["mock"],
}

/**
 * Whether the `ollama` provider should be offered in the UI.
 *
 * Ollama talks to a localhost model server - unreachable from Cloud Run,
 * so the hosted web build hides it. It is shown in local dev, and the
 * future Electron desktop build opts in explicitly via
 * NEXT_PUBLIC_ENABLE_LOCAL_AI=1.
 */
export function isLocalAiAvailable(): boolean {
  return (
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_AI === "1" ||
    process.env.NODE_ENV !== "production"
  )
}
