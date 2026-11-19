import type { Content } from "@google/genai"
import type { LlmRequest, LlmResponse, SingleBeforeToolCallback } from "@google/adk"

import { DEFAULT_BRAND_ID } from "@/lib/constants/timbl"
import { readBrand } from "@/lib/brand/brand-store"
import type { AgentBudgets, AgentFinisher } from "@/lib/schemas/agentConfig"

import { BudgetExceededError } from "./budget"
import { getRuntimeCtx } from "./context"
import {
  estimatePromptTokens,
  meterForContext,
  recordCall,
  usageFromResponse,
  worstCaseUsd,
} from "./cost-meter"
import { GLOBAL_OUTPUT_GUARDRAILS } from "./guardrails"
import { resolveLlm } from "./llm-registry"
import { resolveMaxTokens } from "./openai-compatible-llm"

/*
 * Quality finisher: a cheap model runs the tool loop, the strong model owns
 * the words. Before a draft-writing tool executes, its copy fields go to the
 * finisher model in one call with the brand profile and the run's request,
 * and the edited copy replaces the loop model's in the tool's args (ADK hands
 * the same args object to the tool). No transcript, no tool schemas, so the
 * strong model is billed for the copy alone.
 *
 * A finisher failure never blocks the save: the loop model's draft goes
 * through unchanged and the failure is logged. A budget refusal does block,
 * like any other call that would cross the run cap.
 */

interface CopyTarget {
  /** Where the copy lives in the tool args. */
  nested?: "patch"
  fields: string[]
  /** Read-only args shown to the finisher for context. */
  context?: string[]
  /** Copy the finisher writes from the brief when the loop model left it out. */
  complete?: string[]
}

const COPY_TARGETS: Record<string, CopyTarget> = {
  createDraftPost: {
    fields: ["blurb", "detailedBrief", "brief", "hashtags", "rationale"],
    context: ["scheduledDate", "channels", "postType"],
    complete: ["blurb"],
  },
  updateDraft: {
    nested: "patch",
    fields: ["blurb", "detailedBrief", "brief", "hashtags", "rationale"],
  },
  useTemplate: {
    fields: ["blurb", "rationale"],
    context: ["template", "scheduledDate"],
    complete: ["blurb"],
  },
  createTemplate: {
    fields: ["blurbTemplate", "defaultHashtags"],
    context: ["name", "cadence", "defaultPostType"],
  },
}

const FINISHER_INSTRUCTION = [
  "You are the final editor for a social media team. A drafting agent wrote the copy in `draft` for one post or template. Make it publish-ready without changing what it is about.",
  "",
  "Rules:",
  "  - Keep the subject, angle, facts, dates, names and numbers. Never add a fact, statistic, quote, offer or promise that is not already in the draft or the brand profile.",
  "  - Write in the brand's voice for its audience. Respect every forbidden topic.",
  "  - Sharpen the opening line, cut filler, make each sentence concrete, and keep a natural next step if the draft has one.",
  "  - Fit the length to the channels listed.",
  "  - If blurb is an empty string, write the post copy from the brief and the brand profile. It is the caption a person will publish.",
  "  - Keep [PLACEHOLDER] tokens exactly as written.",
  "  - Hashtags: relevant and few, never more than the draft had.",
  "  - brief, detailedBrief and rationale are internal notes for the team: keep them short, factual and in plain language.",
  "  - Deliberate choices in the draft stay, for example a correction applied from a reviewer. If a field is already strong, return it unchanged.",
  "",
  "Return only a JSON object with exactly the keys in `draft`, each with the same type. No prose, no code fences.",
].join("\n")

function sameShape(original: unknown, edited: unknown): boolean {
  if (typeof original === "string") return typeof edited === "string" && edited.trim().length > 0
  if (Array.isArray(original)) {
    return Array.isArray(edited) && edited.every((v) => typeof v === "string" && v.length > 0)
  }
  return false
}

function parseJsonObject(text: string): Record<string, unknown> | undefined {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start < 0 || end <= start) return undefined
  try {
    const parsed = JSON.parse(text.slice(start, end + 1))
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

function textOf(content: Content | undefined): string {
  return (content?.parts ?? []).map((p) => p.text ?? "").join("").trim()
}

export function makeFinisherCallback(
  finisher: AgentFinisher,
  budgets: AgentBudgets,
): SingleBeforeToolCallback {
  const maxOutputTokens = resolveMaxTokens(finisher.model)
  const agentCap = budgets.maxUsdCost > 0 ? budgets.maxUsdCost : Infinity

  return async ({ tool, args, context }) => {
    const target = COPY_TARGETS[tool.name]
    if (!target || process.env.AGENT_MOCK_LLM === "1") return undefined

    const holder = (target.nested ? args[target.nested] : args) as
      | Record<string, unknown>
      | undefined
    if (!holder) return undefined
    const draft: Record<string, unknown> = {}
    for (const field of target.fields) {
      const value = holder[field]
      if ((typeof value === "string" && value.trim()) || (Array.isArray(value) && value.length)) {
        draft[field] = value
      }
    }
    if (!["blurb", "blurbTemplate", "brief", "detailedBrief"].some((k) => k in draft)) {
      return undefined
    }
    for (const field of target.complete ?? []) {
      if (!(field in draft)) draft[field] = ""
    }

    const { orgId, brandId } = getRuntimeCtx(context)
    const brand = await readBrand(orgId, brandId ?? DEFAULT_BRAND_ID)
    const readOnly = Object.fromEntries(
      (target.context ?? []).filter((k) => args[k] !== undefined).map((k) => [k, args[k]]),
    )
    const payload = {
      brand: brand
        ? {
            name: brand.name,
            voice: brand.voice,
            audience: brand.audience,
            channels: brand.channels,
            forbiddenTopics: brand.forbiddenTopics,
            samplePosts: brand.samplePosts,
            notes: brand.notes,
          }
        : null,
      request: textOf(context.userContent),
      context: readOnly,
      draft,
    }

    const llm = resolveLlm({
      provider: "openrouter",
      model: finisher.model,
      reasoningEffort: finisher.reasoningEffort,
    })
    if (typeof llm === "string") return undefined

    const system = `${FINISHER_INSTRUCTION}\n\n${GLOBAL_OUTPUT_GUARDRAILS}`
    const meter = meterForContext(context)
    if (meter) {
      const cap = Math.min(agentCap, meter.capUsd)
      const worst = worstCaseUsd(
        finisher.model,
        estimatePromptTokens({ system, payload }),
        maxOutputTokens,
      )
      if (cap !== Infinity && meter.usdCost + worst > cap) {
        throw new BudgetExceededError(
          "max_usd_cost",
          `Run budget $${cap.toFixed(2)} would be exceeded by the quality finisher: spent $${meter.usdCost.toFixed(4)}, next call could cost up to $${worst.toFixed(4)}`,
        )
      }
    }

    const request = {
      model: finisher.model,
      contents: [{ role: "user", parts: [{ text: JSON.stringify(payload) }] }],
      config: { systemInstruction: system },
      toolsDict: {},
      liveConnectConfig: {},
    } as unknown as LlmRequest

    let final: LlmResponse | undefined
    try {
      for await (const response of llm.generateContentAsync(request, false)) {
        if (!response.partial) final = response
      }
    } catch (err) {
      console.warn(
        `[finisher] ${finisher.model} failed on ${tool.name}, keeping the loop draft: ${err instanceof Error ? err.message : err}`,
      )
      return undefined
    }
    if (!final) return undefined

    const usage = usageFromResponse(finisher.model, final)
    if (usage && meter) recordCall(meter, usage)

    const edited = parseJsonObject(textOf(final.content))
    if (!edited) {
      console.warn(`[finisher] unparseable output on ${tool.name}, keeping the loop draft`)
      return undefined
    }
    for (const [field, original] of Object.entries(draft)) {
      if (sameShape(original, edited[field])) holder[field] = edited[field]
    }
    return undefined
  }
}
