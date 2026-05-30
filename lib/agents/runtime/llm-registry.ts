import { BaseLlm, Gemini, LLMRegistry } from "@google/adk"

import type { AgentProvider } from "@/lib/schemas/agentConfig"
import { AnthropicLlm } from "./anthropic-llm"
import { MockLlm } from "./mock-llm"
import { OpenAiCompatibleLlm } from "./openai-compatible-llm"

/*
 * Resolves a BaseLlm instance for a given agentConfig.{provider,model}.
 *
 * Resolution order:
 *   1. AGENT_MOCK_LLM=1 → MockLlm, regardless of provider. Tests and
 *      verifications run deterministically without network.
 *   2. provider === "mock" → MockLlm (explicit per-agent opt-in).
 *   3. provider === "anthropic" → AnthropicLlm.
 *   4. provider === "openrouter" → OpenAiCompatibleLlm (OpenRouter base URL +
 *      platform OPENROUTER_API_KEY).
 *   5. provider === "ollama" → OpenAiCompatibleLlm (local Ollama, no key).
 *   6. provider === "gemini" (default) → Gemini.
 *
 * `AgentProvider` is imported from the zod schema in lib/schemas/agentConfig
 * so the enum has a single source of truth.
 */

let registered = false

/* One-time warn dedupe - keyed so each distinct fallback message logs once
 * per process. Avoids spamming the console on hot reload + repeated calls. */
const warnedKeys = new Set<string>()
function warnOnce(key: string, message: string) {
  if (warnedKeys.has(key)) return
  warnedKeys.add(key)
  console.warn(message)
}

function ensureRegistered() {
  if (registered) return
  // adk-js's LLMRegistry maps model-name regexes to LLM classes. Direct
  // instantiation in resolveLlm() is the real path; the registry calls are
  // belt-and-braces in case anything in adk-js looks a model up by string.
  try {
    LLMRegistry.register(MockLlm)
    LLMRegistry.register(AnthropicLlm)
    LLMRegistry.register(OpenAiCompatibleLlm)
  } catch {
    /* duplicate-registration is fine on hot reload */
  }
  registered = true
}

export interface ResolveLlmInput {
  provider: AgentProvider
  model: string
}

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1"

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

function readOpenRouterKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY
}

function readOllamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL
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
        "[llm-registry] No Anthropic key set - using MockLlm",
      )
      return new MockLlm({ model: input.model })
    }
    case "openrouter": {
      const openRouterKey = readOpenRouterKey()
      if (openRouterKey) {
        return new OpenAiCompatibleLlm({
          model: input.model,
          apiKey: openRouterKey,
          baseUrl: OPENROUTER_BASE_URL,
        })
      }
      warnOnce(
        "openrouter-missing-mock",
        "[llm-registry] No OPENROUTER_API_KEY set - using MockLlm",
      )
      return new MockLlm({ model: input.model })
    }
    case "ollama": {
      // Ollama is a local server - no API key. On Cloud Run localhost is
      // unreachable; the UI gates this provider to dev/desktop (§6.5).
      return new OpenAiCompatibleLlm({
        model: input.model,
        baseUrl: readOllamaBaseUrl(),
      })
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
          "[llm-registry] No Gemini key - falling back to Anthropic for agent provider=gemini",
        )
        return new AnthropicLlm({ model: "claude-sonnet-4-6" })
      }
      warnOnce(
        "gemini-missing-mock",
        "[llm-registry] No LLM keys set - using MockLlm",
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
 * Gemini isn't available - most agents in the seeds default to Gemini,
 * so any non-Gemini effective provider is treated as a degraded state.
 *
 * The per-provider booleans (`gemini`/`anthropic`/`openrouter`) report
 * whether each provider has a usable key configured, so the settings UI
 * can show an "AI connections" status. `ollama` is keyless (local server)
 * and so isn't reported here.
 */
export function detectLlmStatus(): {
  gemini: boolean
  anthropic: boolean
  openrouter: boolean
  effective: "gemini" | "anthropic" | "mock"
  fallback: boolean
} {
  const gemini = !!readGeminiKey()
  const anthropic = !!readAnthropicKey()
  const openrouter = !!readOpenRouterKey()
  const effective: "gemini" | "anthropic" | "mock" = gemini
    ? "gemini"
    : anthropic
      ? "anthropic"
      : "mock"
  return { gemini, anthropic, openrouter, effective, fallback: effective !== "gemini" }
}
