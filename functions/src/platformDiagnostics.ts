import { onSchedule } from "firebase-functions/v2/scheduler"
import { defineSecret } from "firebase-functions/params"
import { logger } from "firebase-functions"
import { getFirestore } from "firebase-admin/firestore"
import Anthropic from "@anthropic-ai/sdk"

/*
 * Platform-wide diagnostics. Daily cross-tenant health digest.
 *
 * Gathers structured facts (spend deltas, a daily-spend spike signal,
 * recent failures grouped by agent, recent quota breaches) straight from
 * Firestore, then asks Claude to turn them into a short list of findings.
 * The narration is best-effort - if the Claude call fails, `raw` still
 * gets written so the underlying numbers are never lost.
 *
 * Path strings are inlined: functions/ has its own tsconfig and can't reach
 * @/lib. Keep in sync with lib/platform/schema.ts (platformDiagnosticRunSchema).
 *   platform/state/rollups/{period}
 *   platform/state/orgRollups/{orgId}/daily/{YYYY-MM-DD}
 *   platform/state/signals
 *   platform/state/diagnostics/{YYYY-MM-DD}
 */

const ROOT = "platform/state"
const MODEL = "claude-haiku-4-5"
const ANTHROPIC_KEY = defineSecret("ANTHROPIC_API_KEY")

function currentPeriod(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0
}

function daysAgo(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() - days)
  return d
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

type DiagnosticSeverity = "info" | "warn" | "critical"

interface DiagnosticFinding {
  severity: DiagnosticSeverity
  category: string
  summary: string
  suggestion: string
}

interface RollupSummary {
  period: string
  usdCost: number
  agentRuns: number
  promptTokens: number
  completionTokens: number
  cachedTokens: number
  embeddingCalls: number
  runsByOutcome: Record<string, number>
  activeOrgs: number
}

async function loadRollup(
  db: FirebaseFirestore.Firestore,
  period: string,
): Promise<RollupSummary | null> {
  const snap = await db.doc(`${ROOT}/rollups/${period}`).get()
  if (!snap.exists) return null
  const d = snap.data() ?? {}
  return {
    period,
    usdCost: num(d.usdCost),
    agentRuns: num(d.agentRuns),
    promptTokens: num(d.promptTokens),
    completionTokens: num(d.completionTokens),
    cachedTokens: num(d.cachedTokens),
    embeddingCalls: num(d.embeddingCalls),
    runsByOutcome: (d.runsByOutcome as Record<string, number>) ?? {},
    activeOrgs: num(d.activeOrgs),
  }
}

async function loadDailySpend(db: FirebaseFirestore.Firestore, now: Date) {
  const cutoff = isoDate(daysAgo(now, 7))
  const snap = await db.collectionGroup("daily").where("date", ">=", cutoff).get()

  const byDate = new Map<string, { usdCost: number; agentRuns: number }>()
  for (const doc of snap.docs) {
    const d = doc.data()
    const date = (d.date as string) ?? doc.id
    const entry = byDate.get(date) ?? { usdCost: 0, agentRuns: 0 }
    entry.usdCost += num(d.usdCost)
    entry.agentRuns += num(d.agentRuns)
    byDate.set(date, entry)
  }

  const dates = [...byDate.keys()].sort()
  const series = dates.map((date) => ({ date, ...byDate.get(date)! }))

  const mostRecentDate = dates.length > 0 ? dates[dates.length - 1] : null
  const mostRecentCost = mostRecentDate ? byDate.get(mostRecentDate)!.usdCost : 0
  const priorDates = dates.slice(0, -1)
  const priorAverage =
    priorDates.length > 0
      ? priorDates.reduce((sum, date) => sum + byDate.get(date)!.usdCost, 0) / priorDates.length
      : 0
  const spikeDetected = priorAverage > 0 && mostRecentCost > 2 * priorAverage

  return { series, mostRecentDate, mostRecentCost, priorAverage, spikeDetected }
}

async function loadRecentFailures(db: FirebaseFirestore.Firestore) {
  const snap = await db
    .collectionGroup("agentRuns")
    .where("status", "==", "failed")
    .orderBy("startedAt", "desc")
    .limit(20)
    .get()

  const byAgent = new Map<string, number>()
  const sample: Array<{ agentName: string; orgId: string | null; error: string | null }> = []
  for (const doc of snap.docs) {
    const d = doc.data()
    const agentName = (d.agentName as string) ?? "unknown"
    const orgId = (d.organizationId as string) ?? null
    const error = (d.error as { message?: string } | undefined)?.message ?? null
    byAgent.set(agentName, (byAgent.get(agentName) ?? 0) + 1)
    sample.push({ agentName, orgId, error })
  }

  return { total: snap.size, byAgent: Object.fromEntries(byAgent), sample }
}

async function loadQuotaBreaches(db: FirebaseFirestore.Firestore) {
  const snap = await db
    .collection(`${ROOT}/signals`)
    .where("kind", "==", "quota.breached")
    .orderBy("createdAt", "desc")
    .limit(20)
    .get()

  const recent = snap.docs.map((doc) => {
    const d = doc.data()
    return {
      orgId: (d.orgId as string | null) ?? null,
      summary: (d.summary as string) ?? "",
      createdAt: (d.createdAt as string) ?? null,
    }
  })

  return { total: snap.size, recent }
}

async function gatherData(db: FirebaseFirestore.Firestore, now: Date) {
  const period = currentPeriod(now)
  const priorPeriodDate = new Date(now)
  priorPeriodDate.setUTCMonth(priorPeriodDate.getUTCMonth() - 1)
  const priorPeriod = currentPeriod(priorPeriodDate)

  const [currentRollup, priorRollup, dailySpend, recentFailures, quotaBreaches] =
    await Promise.all([
      loadRollup(db, period),
      loadRollup(db, priorPeriod),
      loadDailySpend(db, now),
      loadRecentFailures(db),
      loadQuotaBreaches(db),
    ])

  return {
    generatedAt: now.toISOString(),
    period: { current: period, prior: priorPeriod, currentRollup, priorRollup },
    dailySpend,
    recentFailures,
    quotaBreaches,
  }
}

async function analyzeWithLlm(
  raw: Record<string, unknown>,
): Promise<{ findings: DiagnosticFinding[]; narrationError: string | null }> {
  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_KEY.value() })
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system:
        "You are the automated health analyst for Timbl, a multi-tenant SaaS. Given ONLY the " +
        "structured data below, return a JSON array of findings, each " +
        '{"severity": ..., "category": ..., "summary": ..., "suggestion": ...}. severity is one ' +
        "of info/warn/critical. Never invent numbers or claims not present in the data. If " +
        "nothing notable, return an empty array. Reply with ONLY the JSON array, no prose.",
      messages: [{ role: "user", content: JSON.stringify(raw) }],
    })
    const text = resp.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim()

    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return { findings: [], narrationError: "no JSON array found in response" }

    const parsed: unknown = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return { findings: [], narrationError: "response was not a JSON array" }

    const findings: DiagnosticFinding[] = []
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue
      const { severity, category, summary, suggestion } = item as Record<string, unknown>
      if (
        (severity === "info" || severity === "warn" || severity === "critical") &&
        typeof category === "string" &&
        typeof summary === "string" &&
        typeof suggestion === "string"
      ) {
        findings.push({ severity, category, summary, suggestion })
      }
    }
    return { findings, narrationError: null }
  } catch (err) {
    return { findings: [], narrationError: err instanceof Error ? err.message : String(err) }
  }
}

/* Plain, directly-callable core - the onSchedule handler below is a thin
 * wrapper around this. Exported so it can be exercised outside the Cloud
 * Functions runtime (e.g. against the Firestore emulator in a throwaway
 * script) without needing the Functions emulator/Scheduler. */
export async function runDiagnostics(
  db: FirebaseFirestore.Firestore,
  now = new Date(),
): Promise<{ findings: DiagnosticFinding[]; narrationError: string | null; criticalCount: number }> {
  const nowIso = now.toISOString()
  const dateStr = isoDate(now)

  const raw = await gatherData(db, now)
  const { findings, narrationError } = await analyzeWithLlm(raw)

  await db.doc(`${ROOT}/diagnostics/${dateStr}`).set(
    {
      id: dateStr,
      date: dateStr,
      findings,
      raw,
      narrationError,
      trigger: "scheduled",
      createdAt: nowIso,
    },
    { merge: false },
  )

  let criticalCount = 0
  for (const finding of findings) {
    if (finding.severity !== "critical") continue
    criticalCount++
    const ref = db.collection(`${ROOT}/signals`).doc()
    await ref.set({
      id: ref.id,
      kind: "diagnostic.critical",
      orgId: null,
      summary: finding.summary,
      meta: { category: finding.category, suggestion: finding.suggestion },
      createdAt: nowIso,
    })
  }

  logger.info("[platformDiagnostics] run complete", {
    findingsCount: findings.length,
    criticalCount,
    narrationFailed: !!narrationError,
  })

  return { findings, narrationError, criticalCount }
}

export const platformDiagnostics = onSchedule(
  {
    schedule: "every 24 hours",
    timeZone: "UTC",
    region: "asia-south1",
    secrets: [ANTHROPIC_KEY],
    timeoutSeconds: 120,
    retryCount: 0,
  },
  async () => {
    await runDiagnostics(getFirestore())
  },
)
