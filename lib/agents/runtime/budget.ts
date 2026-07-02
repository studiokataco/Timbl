import type {
  SingleAfterModelCallback,
  SingleBeforeModelCallback,
  SingleBeforeToolCallback,
} from "@google/adk"

import type { AgentBudgets } from "@/lib/schemas/agentConfig"
import { estimateUsdCost } from "../pricing"

/*
 * Budget enforcement - strict-mode counters on LLM calls, tool calls, and
 * live USD cost. Hooks BeforeModel / AfterModel / BeforeTool so a
 * misbehaving agent can be cut off before it makes another expensive call
 * rather than after.
 *
 * usdCost is accumulated in afterModel from each response's usageMetadata
 * (same estimate route.ts uses for the run's final metrics) and checked in
 * beforeModel/beforeTool, so maxUsdCost is a real per-run hard cap, not
 * just a trailing metric. It can only stop the *next* call - the call
 * already in flight when the cap is crossed still completes.
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

  function checkUsdCost(): void {
    if (budgets.maxUsdCost > 0 && state.usdCost >= budgets.maxUsdCost) {
      throw new BudgetExceededError(
        "max_usd_cost",
        `Agent exceeded maxUsdCost ($${budgets.maxUsdCost.toFixed(2)}), spent $${state.usdCost.toFixed(2)}`,
      )
    }
  }

  const beforeModel: SingleBeforeModelCallback = () => {
    if (state.llmCalls >= budgets.maxLlmCalls) {
      throw new BudgetExceededError(
        "max_llm_calls",
        `Agent exceeded max_llm_calls (${budgets.maxLlmCalls})`,
      )
    }
    checkUsdCost()
    state.llmCalls += 1
    return undefined
  }

  const afterModel: SingleAfterModelCallback = ({ response }) => {
    const usage = response.usageMetadata
    if (usage) {
      state.usdCost += estimateUsdCost(
        model,
        usage.promptTokenCount ?? 0,
        usage.candidatesTokenCount ?? 0,
        usage.cachedContentTokenCount ?? 0,
      )
    }
    return undefined
  }

  const beforeTool: SingleBeforeToolCallback = () => {
    if (state.toolCalls >= budgets.maxToolCalls) {
      throw new BudgetExceededError(
        "max_tool_calls",
        `Agent exceeded max_tool_calls (${budgets.maxToolCalls})`,
      )
    }
    checkUsdCost()
    state.toolCalls += 1
    return undefined
  }

  return { beforeModel, afterModel, beforeTool, state }
}
