"use server"

import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { runPlatformDiagnostics } from "@/lib/platform/diagnostics/run"

export interface RunDiagnosticsResponse {
  ok: boolean
  findingsCount?: number
  criticalCount?: number
  narrationError?: string | null
  error?: string
}

export async function runDiagnosticsNow(): Promise<RunDiagnosticsResponse> {
  await requirePlatformAdmin()
  try {
    const result = await runPlatformDiagnostics("manual")
    return {
      ok: true,
      findingsCount: result.findings.length,
      criticalCount: result.criticalCount,
      narrationError: result.narrationError,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "diagnostics_run_failed" }
  }
}
