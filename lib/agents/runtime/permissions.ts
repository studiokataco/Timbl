import type { SingleBeforeToolCallback } from "@google/adk"

/*
 * Permissions — per-agent tool allowlist enforced via the BeforeToolCallback
 * hook on LlmAgent. If a tool is invoked outside its agent's allowedTools,
 * the callback returns a synthetic response with `error: "forbidden"` and
 * adk-js skips the real execution. The agent sees the rejection in the
 * normal tool_result event flow, so its own reasoning can recover.
 */

export function makePermissionsCallback(
  allowedTools: ReadonlyArray<string>,
): SingleBeforeToolCallback {
  const allowSet = new Set(allowedTools)
  return ({ tool }) => {
    if (allowSet.size === 0) return undefined // wildcard
    if (allowSet.has(tool.name)) return undefined
    return {
      ok: false,
      error: "forbidden",
      reason: `Agent is not allowed to call "${tool.name}". Allowed tools: ${[...allowSet].join(", ") || "(none)"}.`,
    }
  }
}
