"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, CheckCircle2, Clock, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { runDiagnosticsNow } from "@/lib/actions/platform/diagnostics"
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

const DAY_MS = 24 * 60 * 60 * 1000

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

function nextRunLabel(latest: PlatformDiagnosticRun | undefined): string {
  if (!latest) return "within 24h of the first scheduled run"
  const next = Date.parse(latest.createdAt) + DAY_MS
  const diff = next - Date.now()
  if (diff <= 0) return "due now"
  const hr = Math.round(diff / (60 * 60 * 1000))
  return hr < 1 ? "< 1h" : `~${hr}h`
}

function RunNowButton({ onDone }: { onDone: () => void }) {
  const [pending, startTransition] = useTransition()
  const run = () => {
    startTransition(async () => {
      const res = await runDiagnosticsNow()
      if (!res.ok) {
        toast.error(res.error ?? "Diagnostics run failed")
        return
      }
      if (res.narrationError) {
        toast.warning(`Ran, but narration failed: ${res.narrationError}`)
      } else {
        toast.success(
          `Diagnostics complete - ${res.findingsCount ?? 0} finding${res.findingsCount === 1 ? "" : "s"}`,
        )
      }
      onDone()
    })
  }
  return (
    <Button size="sm" onClick={run} disabled={pending}>
      <RefreshCw className={cn("size-4", pending && "animate-spin")} />
      {pending ? "Running..." : "Run now"}
    </Button>
  )
}

function ScheduleHeader({
  latest,
  onDone,
}: {
  latest: PlatformDiagnosticRun | undefined
  onDone: () => void
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h2 className="font-heading text-sm font-semibold tracking-tight">Automated health checks</h2>
        <p className="max-w-xl text-xs text-muted-foreground">
          Runs daily. Reads spend, failures, and quota breaches across every tenant, then Claude
          narrates what needs attention. Findings are suggestions - nothing is auto-applied.
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            Last run {latest ? relativeTime(latest.createdAt) : "never"}
          </span>
          <span aria-hidden>·</span>
          <span>Next automatic run {nextRunLabel(latest)}</span>
          {latest ? (
            <>
              <span aria-hidden>·</span>
              <span className="capitalize">{latest.trigger} trigger</span>
            </>
          ) : null}
        </div>
      </div>
      <RunNowButton onDone={onDone} />
    </div>
  )
}

function RawSnapshot({ raw }: { raw: Record<string, unknown> }) {
  if (!raw || Object.keys(raw).length === 0) return null
  return (
    <details className="group rounded-xl bg-card ring-1 ring-foreground/10">
      <summary className="cursor-pointer select-none px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground group-open:text-foreground">
        <span className="group-open:hidden">Show underlying data</span>
        <span className="hidden group-open:inline">Hide underlying data</span>
      </summary>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-b-xl bg-muted/50 p-4 font-mono text-xs">
        {JSON.stringify(raw, null, 2)}
      </pre>
    </details>
  )
}

export function DiagnosticsPanel({ runs }: { runs: PlatformDiagnosticRun[] }) {
  const router = useRouter()
  const [refreshKey, setRefreshKey] = useState(0)
  const onDone = () => {
    router.refresh()
    setRefreshKey((k) => k + 1)
  }

  const latest = runs[0]

  if (!latest) {
    return (
      <div className="flex flex-col gap-4">
        <ScheduleHeader latest={undefined} onDone={onDone} />
        <div className="flex flex-col items-center gap-3 rounded-xl bg-card py-12 text-center ring-1 ring-foreground/10">
          <p className="text-sm text-muted-foreground">
            No diagnostics have run yet. The daily check will populate this automatically -
            or run one now to see it immediately.
          </p>
          <RunNowButton onDone={onDone} />
        </div>
      </div>
    )
  }

  const findings = [...latest.findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  )

  return (
    <div key={refreshKey} className="flex flex-col gap-4">
      <ScheduleHeader latest={latest} onDone={onDone} />

      {latest.narrationError ? (
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-500">
          <AlertTriangle className="size-4 shrink-0" />
          Narration failed for this run - {latest.narrationError}. The underlying data below is
          still complete.
        </div>
      ) : null}

      {findings.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl bg-card p-4 text-sm text-muted-foreground ring-1 ring-foreground/10">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
          {latest.narrationError
            ? "No findings could be generated - see the error above."
            : "Nothing needs attention. No findings for this run."}
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

      <RawSnapshot raw={latest.raw} />
    </div>
  )
}
