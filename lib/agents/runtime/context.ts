import type { Context } from "@google/adk"

/*
 * Tools are constructed once at module load and discover the current org +
 * user from session state instead of closing over them at construction time
 * (which would force a fresh tool tree per request). startRun() seeds
 * `state.runtime` for every session before the runner starts streaming.
 *
 * Throw — don't return undefined — when context is missing. A tool called
 * outside a properly-bootstrapped session is a programming error, not a
 * user-visible state.
 */

export interface RuntimeCtx {
  orgId: string
  userId: string
  runId: string
  agentName: string
}

export const RUNTIME_STATE_KEY = "_runtime"

export function getRuntimeCtx(ctx: Context | undefined): RuntimeCtx {
  if (!ctx) {
    throw new Error(
      "Agent tool invoked without a Context — adk-js wiring bug",
    )
  }
  const raw = ctx.state.get(RUNTIME_STATE_KEY) as Partial<RuntimeCtx> | undefined
  if (!raw?.orgId || !raw.userId || !raw.runId || !raw.agentName) {
    throw new Error(
      "Agent runtime context missing in session state — startRun() did not seed _runtime",
    )
  }
  return raw as RuntimeCtx
}

export function runtimeStateDelta(ctx: RuntimeCtx): Record<string, unknown> {
  return { [RUNTIME_STATE_KEY]: ctx }
}
