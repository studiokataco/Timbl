import type {
  SingleBeforeModelCallback,
  SingleBeforeToolCallback,
} from "@google/adk"

import type { AgentBudgets } from "@/lib/schemas/agentConfig"

/*
 * Budget enforcement - strict-mode counters on LLM calls and tool calls.
 * Hooks BeforeModel / BeforeTool so a misbehaving agent can be cut off
 * before it makes another expensive call rather than after.
 *
 * Cost accounting (usdCost) is computed in route.ts from usage metadata
 * after the run finishes. The "hard cap" honoured here is the per-run
 * call-count ceiling - that's the lever that actually prevents runaways
 * during a stuck loop. The dollar cap is best-effort and emitted as a
 * trailing metric.
 */

export interface BudgetState {
  llmCalls: number
  toolCalls: number
}

export interface BudgetCallbacks {
  beforeModel: SingleBeforeModelCallback
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

export function makeBudgetCallbacks(budgets: AgentBudgets): BudgetCallbacks {
  const state: BudgetState = { llmCalls: 0, toolCalls: 0 }

  const beforeModel: SingleBeforeModelCallback = () => {
    if (state.llmCalls >= budgets.maxLlmCalls) {
      throw new BudgetExceededError(
        "max_llm_calls",
        `Agent exceeded max_llm_calls (${budgets.maxLlmCalls})`,
      )
    }
    state.llmCalls += 1
    return undefined
  }

  const beforeTool: SingleBeforeToolCallback = () => {
    if (state.toolCalls >= budgets.maxToolCalls) {
      throw new BudgetExceededError(
        "max_tool_calls",
        `Agent exceeded max_tool_calls (${budgets.maxToolCalls})`,
      )
    }
    state.toolCalls += 1
    return undefined
  }

  return { beforeModel, beforeTool, state }
}
