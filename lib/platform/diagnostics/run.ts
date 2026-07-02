import "server-only"

import Anthropic from "@anthropic-ai/sdk"

import { getAdminDb } from "@/lib/firebase/admin"
import { writePlatformSignal } from "@/lib/platform/signals"
import {
  platformDiagnosticsDocPath,
  platformRollupDocPath,
  platformSignalsPath,
  type PlatformDiagnosticFinding,
  type PlatformDiagnosticTrigger,
} from "@/lib/platform/schema"

/*
 * Platform diagnostics - Next-side runner. Same job as the daily Cloud
 * Function (functions/src/platformDiagnostics.ts): gather cross-tenant
 * facts, ask Claude to narrate findings, write one dated digest doc plus a
 * signal per critical finding.
 *
 * Two copies exist because functions/ has its own tsconfig and cannot import
 * @/lib. This one backs the on-demand "Run now" button (runs in a request
 * context, so it can use the real path/signal helpers); the function backs
 * the daily cron. Keep the analysis prompt and data shape in sync between
 * the two - the schema they both write is platformDiagnosticRunSchema.
 */

const MODEL = "claude-haiku-4-5"

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

function currentPeriod(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

type Db = FirebaseFirestore.Firestore

async function loadRollup(db: Db, period: string) {
  const snap = await db.doc(platformRollupDocPath(period)).get()
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

async function loadDailySpend(db: Db, now: Date) {
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

async function loadRecentFailures(db: Db) {
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

async function loadQuotaBreaches(db: Db) {
  const snap = await db
    .collection(platformSignalsPath)
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

async function gatherData(db: Db, now: Date) {
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
): Promise<{ findings: PlatformDiagnosticFinding[]; narrationError: string | null }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { findings: [], narrationError: "ANTHROPIC_API_KEY not configured" }

  try {
    const client = new Anthropic({ apiKey })
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

    const findings: PlatformDiagnosticFinding[] = []
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

export interface DiagnosticsRunResult {
  id: string
  findings: PlatformDiagnosticFinding[]
  narrationError: string | null
  criticalCount: number
}

export async function runPlatformDiagnostics(
  trigger: PlatformDiagnosticTrigger = "manual",
  now = new Date(),
): Promise<DiagnosticsRunResult> {
  const db = getAdminDb()
  const nowIso = now.toISOString()
  const dateStr = isoDate(now)

  const raw = await gatherData(db, now)
  const { findings, narrationError } = await analyzeWithLlm(raw)

  await db.doc(platformDiagnosticsDocPath(dateStr)).set(
    { id: dateStr, date: dateStr, findings, raw, narrationError, trigger, createdAt: nowIso },
    { merge: false },
  )

  let criticalCount = 0
  for (const finding of findings) {
    if (finding.severity !== "critical") continue
    criticalCount++
    await writePlatformSignal({
      kind: "diagnostic.critical",
      orgId: null,
      summary: finding.summary,
      meta: { category: finding.category, suggestion: finding.suggestion },
    })
  }

  return { id: dateStr, findings, narrationError, criticalCount }
}
