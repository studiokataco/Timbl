import type { AgentProvider } from "@/lib/schemas/agentConfig"

/*
 * Provider UI catalog — suggested model IDs per provider and the
 * local-AI availability gate. Client-safe: reads only NEXT_PUBLIC_* and
 * NODE_ENV so it can be imported into client components.
 *
 * Model IDs are sourced verbatim from the phase plan's §4 shortlist
 * (safe-pluggable-ai-providers-ab.md). These are *suggestions* surfaced
 * in a free-text <datalist> — the model field stays z.string(), so an
 * operator can always type an ID not listed here.
 */

/** Suggested model IDs per provider (datalist hints — not an allowlist). */
export const MODEL_SUGGESTIONS: Record<AgentProvider, readonly string[]> = {
  gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-3.5-flash"],
  anthropic: ["claude-haiku-4-5-20251001", "claude-sonnet-4-6"],
  openrouter: [
    "deepseek/deepseek-v4-flash",
    "z-ai/glm-5.1",
    "qwen/qwen3.6-plus",
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
 * Ollama talks to a localhost model server — unreachable from Cloud Run,
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
