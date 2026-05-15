import { BaseLlm, Gemini, LLMRegistry } from "@google/adk"

import { AnthropicLlm } from "./anthropic-llm"
import { MockLlm } from "./mock-llm"

/*
 * Resolves a BaseLlm instance for a given agentConfig.{provider,model}.
 *
 * Resolution order:
 *   1. AGENT_MOCK_LLM=1 → MockLlm, regardless of provider. Tests and
 *      verifications run deterministically without network.
 *   2. provider === "mock" → MockLlm (explicit per-agent opt-in).
 *   3. provider === "anthropic" → AnthropicLlm (registered in Phase 4).
 *   4. provider === "gemini" (default) → Gemini.
 *
 * The Phase 4 Anthropic adapter calls `registerAnthropic()` once at module
 * load so we can keep the resolver dumb.
 */

let registered = false

/* One-time warn dedupe — keyed so each distinct fallback message logs once
 * per process. Avoids spamming the console on hot reload + repeated calls. */
const warnedKeys = new Set<string>()
function warnOnce(key: string, message: string) {
  if (warnedKeys.has(key)) return
  warnedKeys.add(key)
  console.warn(message)
}

function ensureRegistered() {
  if (registered) return
  // adk-js's LLMRegistry maps model-name regexes to LLM classes. Register
  // MockLlm so the `mock:gemini` / `mock:anthropic` model names route
  // through `LLMRegistry.newLlm(model)` if anything in adk-js looks them up
  // by string. Direct instantiation in resolveLlm() also works — the
  // registry call is belt-and-braces.
  try {
    LLMRegistry.register(MockLlm)
    LLMRegistry.register(AnthropicLlm)
  } catch {
    /* duplicate-registration is fine on hot reload */
  }
  registered = true
}

export type AgentProvider = "gemini" | "anthropic" | "mock"

export interface ResolveLlmInput {
  provider: AgentProvider
  model: string
}

function readGeminiKey(): string | undefined {
  return (
    process.env.GOOGLE_GENAI_API_KEY ??
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY
  )
}

function readAnthropicKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY
}

export function resolveLlm(input: ResolveLlmInput): BaseLlm | string {
  ensureRegistered()
  if (process.env.AGENT_MOCK_LLM === "1") return new MockLlm({ model: input.model })

  const geminiKey = readGeminiKey()
  const anthropicKey = readAnthropicKey()

  switch (input.provider) {
    case "mock":
      return new MockLlm({ model: input.model })
    case "anthropic": {
      if (anthropicKey) return new AnthropicLlm({ model: input.model })
      warnOnce(
        "anthropic-missing-mock",
        "[llm-registry] No LLM keys set — using MockLlm",
      )
      return new MockLlm({ model: input.model })
    }
    case "gemini":
    default: {
      // adk-js Gemini looks for GOOGLE_GENAI_API_KEY / GEMINI_API_KEY; the
      // rest of this repo (and our .env.example) standardise on
      // GOOGLE_API_KEY so we map it explicitly.
      if (geminiKey) return new Gemini({ model: input.model, apiKey: geminiKey })
      if (anthropicKey) {
        warnOnce(
          "gemini-missing-anthropic-fallback",
          "[llm-registry] No Gemini key — falling back to Anthropic for agent provider=gemini",
        )
        return new AnthropicLlm({ model: "claude-sonnet-4-6" })
      }
      warnOnce(
        "gemini-missing-mock",
        "[llm-registry] No LLM keys set — using MockLlm",
      )
      return new MockLlm({ model: input.model })
    }
  }
}

/**
 * Cheap snapshot of the LLM environment so the UI can render a banner when
 * we're degraded from the configured provider. Used by
 * `lib/actions/llm-status.ts`.
 *
 * `effective` describes the LLM the registry would actually instantiate
 * for the most common (Gemini-default) agent. `fallback` is true when
 * Gemini isn't available — most agents in the seeds default to Gemini,
 * so any non-Gemini effective provider is treated as a degraded state.
 */
export function detectLlmStatus(): {
  gemini: boolean
  anthropic: boolean
  effective: "gemini" | "anthropic" | "mock"
  fallback: boolean
} {
  const gemini = !!readGeminiKey()
  const anthropic = !!readAnthropicKey()
  const effective: "gemini" | "anthropic" | "mock" = gemini
    ? "gemini"
    : anthropic
      ? "anthropic"
      : "mock"
  return { gemini, anthropic, effective, fallback: effective !== "gemini" }
}

