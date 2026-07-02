import { AlertTriangle } from "lucide-react"

import { relativeTime } from "@/lib/platform/format"
import type { PlatformDiagnosticFinding, PlatformDiagnosticRun } from "@/lib/platform/schema"
import { cn } from "@/lib/utils"

const SEVERITY_TONE: Record<PlatformDiagnosticFinding["severity"], string> = {
  critical: "bg-red-500/15 text-red-700 dark:text-red-400",
  warn: "bg-amber-500/15 text-amber-700 dark:text-amber-500",
  info: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
}

const SEVERITY_ORDER: Record<PlatformDiagnosticFinding["severity"], number> = {
  critical: 0,
  warn: 1,
  info: 2,
}

function SeverityBadge({ severity }: { severity: PlatformDiagnosticFinding["severity"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        SEVERITY_TONE[severity],
      )}
    >
      {severity}
    </span>
  )
}

export function DiagnosticsPanel({ runs }: { runs: PlatformDiagnosticRun[] }) {
  if (runs.length === 0) {
    return (
      <div className="rounded-xl bg-card py-12 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        No diagnostics runs yet.
      </div>
    )
  }

  const [latest] = runs
  const findings = [...latest.findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          Latest run - {latest.date}
        </h2>
        <span className="text-xs text-muted-foreground">{relativeTime(latest.createdAt)}</span>
      </div>

      {latest.narrationError ? (
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-500">
          <AlertTriangle className="size-4 shrink-0" />
          Narration failed for this run - {latest.narrationError}
        </div>
      ) : null}

      {findings.length === 0 ? (
        <div className="rounded-xl bg-card py-12 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          No findings for this run.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {findings.map((finding, i) => (
            <div key={i} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{finding.category}</span>
                <SeverityBadge severity={finding.severity} />
              </div>
              <p className="mt-2 text-sm text-foreground">{finding.summary}</p>
              <p className="mt-1 text-sm text-muted-foreground">{finding.suggestion}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
