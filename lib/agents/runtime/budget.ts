import type {
  SingleAfterModelCallback,
  SingleBeforeModelCallback,
  SingleBeforeToolCallback,
} from "@google/adk"

import type { AgentBudgets } from "@/lib/schemas/agentConfig"

import {
  callUsd,
  estimatePromptTokens,
  meterForContext,
  recordCall,
  usageFromResponse,
  worstCaseUsd,
  type RunMeter,
} from "./cost-meter"
import { resolveMaxTokens } from "./openai-compatible-llm"

/*
 * Budget enforcement - strict-mode counters on LLM calls, tool calls, and
 * USD spend. Call and tool counts are per agent; spend is per RUN, read from
 * the run meter every agent in the run shares (cost-meter.ts).
 *
 * The USD cap is the tighter of this agent's maxUsdCost and the run meter's
 * cap (which startAgentRun narrows to the org's and the agent's remaining
 * monthly headroom). It is checked before each model call against that
 * call's worst case, so a call that could cross the cap never starts.
 */

export interface BudgetState {
  llmCalls: number
  toolCalls: number
  usdCost: number
}

export interface BudgetCallbacks {
  beforeModel: SingleBeforeModelCallback
  afterModel: SingleAfterModelCallback
  beforeTool: SingleBeforeToolCallback
  state: BudgetState
}

export class BudgetExceededError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = "BudgetExceededError"
    this.code = code
  }
}

export function makeBudgetCallbacks(
  budgets: AgentBudgets,
  model: string,
): BudgetCallbacks {
  const state: BudgetState = { llmCalls: 0, toolCalls: 0, usdCost: 0 }
  const agentCap = budgets.maxUsdCost > 0 ? budgets.maxUsdCost : Infinity
  const maxOutputTokens = resolveMaxTokens(model.replace(/^(openrouter|ollama)\//, ""))

  function capFor(meter: RunMeter | undefined): number {
    return Math.min(agentCap, meter?.capUsd ?? Infinity)
  }

  function spentFor(meter: RunMeter | undefined): number {
    return meter?.usdCost ?? state.usdCost
  }

  function checkSpend(meter: RunMeter | undefined, nextCallUsd = 0): void {
    const cap = capFor(meter)
    if (cap === Infinity) return
    const spent = spentFor(meter)
    if (spent + nextCallUsd > cap) {
      throw new BudgetExceededError(
        "max_usd_cost",
        nextCallUsd > 0
          ? `Run budget $${cap.toFixed(2)} would be exceeded: spent $${spent.toFixed(4)}, next call could cost up to $${nextCallUsd.toFixed(4)}`
          : `Run exceeded its budget ($${cap.toFixed(2)}), spent $${spent.toFixed(4)}`,
      )
    }
  }

  const beforeModel: SingleBeforeModelCallback = ({ context, request }) => {
    if (state.llmCalls >= budgets.maxLlmCalls) {
      throw new BudgetExceededError(
        "max_llm_calls",
        `Agent exceeded max_llm_calls (${budgets.maxLlmCalls})`,
      )
    }
    const meter = meterForContext(context)
    const promptTokens = estimatePromptTokens({
      system: request.config?.systemInstruction,
      contents: request.contents,
    })
    checkSpend(meter, worstCaseUsd(model, promptTokens, maxOutputTokens))
    state.llmCalls += 1
    return undefined
  }

  const afterModel: SingleAfterModelCallback = ({ context, response }) => {
    const call = usageFromResponse(model, response)
    if (!call) return undefined
    const meter = meterForContext(context)
    state.usdCost += meter ? recordCall(meter, call) : callUsd(call)
    return undefined
  }

  const beforeTool: SingleBeforeToolCallback = ({ context }) => {
    if (state.toolCalls >= budgets.maxToolCalls) {
      throw new BudgetExceededError(
        "max_tool_calls",
        `Agent exceeded max_tool_calls (${budgets.maxToolCalls})`,
      )
    }
    checkSpend(meterForContext(context))
    state.toolCalls += 1
    return undefined
  }

  return { beforeModel, afterModel, beforeTool, state }
}
