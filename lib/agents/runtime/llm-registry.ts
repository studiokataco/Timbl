import { BaseLlm, Gemini, LLMRegistry } from "@google/adk"

import type { AgentProvider } from "@/lib/schemas/agentConfig"
import { AnthropicLlm } from "./anthropic-llm"
import { MockLlm } from "./mock-llm"
import { OpenAiCompatibleLlm } from "./openai-compatible-llm"
import { ResilientLlm } from "./resilient-llm"

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
 * Every real provider is then wrapped in ResilientLlm, which retries
 * transient 429/503 with backoff and fails over to a second provider once
 * retries are exhausted. Agents carrying provider-native server tools pass
 * `nativeTools`, which limits that failover to a grounding-capable provider.
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
  /** Enable OpenRouter's web-search server tool. Ignored by non-OpenAI-
   * compatible providers. */
  webSearch?: boolean
  /** Set by agents that attach provider-native server tools (GOOGLE_SEARCH,
   * URL_CONTEXT). Restricts cross-provider fallback to a provider that can
   * ground the request another way; see resolveFallback. */
  nativeTools?: boolean
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

/* Fallback models. A model ID is provider-specific, so a cross-provider
 * fallback cannot reuse the agent's configured model - it needs a designated
 * equivalent on the target provider. Mid-tier on purpose: the fallback runs
 * during someone else's outage, so it should be dependable rather than cheap. */
const FALLBACK_OPENROUTER_MODEL = "google/gemini-3.1-flash-lite"
const FALLBACK_GEMINI_MODEL = "gemini-3.5-flash"
const FALLBACK_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"

/*
 * Picks a DIFFERENT provider to absorb the request once the primary has
 * exhausted its retries. Returns undefined when no other provider is
 * reachable, or when the primary is local/mock (nothing to fail over from).
 *
 * `nativeTools` narrows rather than blocks the choice. GOOGLE_SEARCH /
 * URL_CONTEXT declarations don't cross providers, but OpenRouter's
 * web-search server tool is an equivalent grounding path, so a grounded
 * agent keeps its grounding through the failover - the OpenAI-compatible
 * adapter builds its tool list from `toolsDict` function declarations and
 * ignores the Gemini-native entries. Text-only fallbacks are still refused
 * for those agents: answering ungrounded is worse than failing.
 */
function resolveFallback(
  input: ResolveLlmInput,
): { llm: BaseLlm; label: string } | undefined {
  if (input.provider === "mock" || input.provider === "ollama") return undefined

  const openRouterKey = readOpenRouterKey()
  const geminiKey = readGeminiKey()
  const anthropicKey = readAnthropicKey()

  if (input.provider !== "openrouter" && openRouterKey) {
    return {
      label: "openrouter",
      llm: new OpenAiCompatibleLlm({
        model: FALLBACK_OPENROUTER_MODEL,
        apiKey: openRouterKey,
        baseUrl: OPENROUTER_BASE_URL,
        webSearch: input.webSearch || input.nativeTools,
      }),
    }
  }
  if (input.nativeTools) return undefined
  if (input.provider !== "gemini" && geminiKey) {
    return {
      label: "gemini",
      llm: new Gemini({ model: FALLBACK_GEMINI_MODEL, apiKey: geminiKey }),
    }
  }
  if (input.provider !== "anthropic" && anthropicKey) {
    return {
      label: "anthropic",
      llm: new AnthropicLlm({ model: FALLBACK_ANTHROPIC_MODEL }),
    }
  }
  return undefined
}

/*
 * Every real provider is wrapped in ResilientLlm so a 429/503 becomes a
 * retry (and then a cross-provider failover) instead of a failed agentRun.
 * MockLlm is returned bare - it cannot fail transiently and wrapping it
 * would only obscure test stack traces.
 */
function withResilience(llm: BaseLlm, input: ResolveLlmInput): BaseLlm {
  const fallback = resolveFallback(input)
  return new ResilientLlm({
    primary: llm,
    fallback: fallback?.llm,
    label: input.provider,
    fallbackLabel: fallback?.label,
  })
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
      if (anthropicKey) {
        return withResilience(new AnthropicLlm({ model: input.model }), input)
      }
      warnOnce(
        "anthropic-missing-mock",
        "[llm-registry] No Anthropic key set - using MockLlm",
      )
      return new MockLlm({ model: input.model })
    }
    case "openrouter": {
      const openRouterKey = readOpenRouterKey()
      if (openRouterKey) {
        return withResilience(
          new OpenAiCompatibleLlm({
            model: input.model,
            apiKey: openRouterKey,
            baseUrl: OPENROUTER_BASE_URL,
            webSearch: input.webSearch,
          }),
          input,
        )
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
      return withResilience(
        new OpenAiCompatibleLlm({
          model: input.model,
          baseUrl: readOllamaBaseUrl(),
        }),
        input,
      )
    }
    case "gemini":
    default: {
      // adk-js Gemini looks for GOOGLE_GENAI_API_KEY / GEMINI_API_KEY; the
      // rest of this repo (and our .env.example) standardise on
      // GOOGLE_API_KEY so we map it explicitly.
      if (geminiKey) {
        return withResilience(
          new Gemini({ model: input.model, apiKey: geminiKey }),
          input,
        )
      }
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
 * no real provider is usable. Used by `lib/actions/llm-status.ts`.
 *
 * OpenRouter is the intended default, so "degraded" no longer means
 * "not Gemini" - it means "no usable provider at all" (mock). `effective`
 * reports the best real provider the registry can reach, preferring
 * OpenRouter; `fallback` is true only when that drops to mock.
 *
 * `webResearch` is true when a provider that supports live grounding is
 * usable - Gemini (native GOOGLE_SEARCH) or OpenRouter (web-search server
 * tool). Tools that require real grounding gate on this rather than on a
 * single provider.
 *
 * The per-provider booleans report whether each provider has a usable key
 * configured, so the settings UI can show an "AI connections" status.
 * `ollama` is keyless (local server) and so isn't reported here.
 */
export function detectLlmStatus(): {
  gemini: boolean
  anthropic: boolean
  openrouter: boolean
  effective: "gemini" | "anthropic" | "openrouter" | "mock"
  fallback: boolean
  webResearch: boolean
} {
  const gemini = !!readGeminiKey()
  const anthropic = !!readAnthropicKey()
  const openrouter = !!readOpenRouterKey()
  const effective: "gemini" | "anthropic" | "openrouter" | "mock" = openrouter
    ? "openrouter"
    : gemini
      ? "gemini"
      : anthropic
        ? "anthropic"
        : "mock"
  return {
    gemini,
    anthropic,
    openrouter,
    effective,
    fallback: effective === "mock",
    webResearch: openrouter || gemini,
  }
}
