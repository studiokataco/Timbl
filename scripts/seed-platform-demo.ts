import { randomUUID } from "node:crypto"

import { getAdminDb } from "@/lib/firebase/admin"
import {
  platformOrgRollupDailyDocPath,
  platformOrgRollupDocPath,
  platformOrgRollupPeriodDocPath,
  platformRollupDocPath,
  safeFieldKey,
} from "@/lib/platform/schema"

/*
 * Demo data for the control centre. Seeds a few tenant orgs with varied
 * plans + usage + agent runs, and materialises the platform rollups directly
 * (so the dashboards have data without waiting for the hourly reconciler).
 * Emulator only. Idempotent-ish: re-running adds more agent runs but
 * overwrites the rollup snapshots.
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 pnpm seed:platform-demo
 */

function ensureEmulator() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("FIRESTORE_EMULATOR_HOST not set - start `pnpm emulators` first")
  }
}

function period(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

interface DemoOrg {
  id: string
  name: string
  plan: string
  usd: number
  runs: number
  failed: number
  byModel: Record<string, { name: string; usd: number }>
  byProvider: Record<string, number>
}

const ORGS: DemoOrg[] = [
  {
    id: "acme-co",
    name: "Acme Co",
    plan: "agency_v1",
    usd: 42.5,
    runs: 320,
    failed: 12,
    byModel: {
      "claude-haiku-4-5": { name: "claude-haiku-4-5", usd: 28.2 },
      "gemini-2.5-flash": { name: "gemini-2.5-flash", usd: 14.3 },
    },
    byProvider: { anthropic: 28.2, gemini: 14.3 },
  },
  {
    id: "beta-labs",
    name: "Beta Labs",
    plan: "studio_v1",
    usd: 11.8,
    runs: 140,
    failed: 3,
    byModel: { "gemini-2.5-flash": { name: "gemini-2.5-flash", usd: 11.8 } },
    byProvider: { gemini: 11.8 },
  },
  {
    id: "gamma-ngo",
    name: "Gamma NGO",
    plan: "free_v1",
    usd: 2.1,
    runs: 38,
    failed: 1,
    byModel: { "claude-haiku-4-5": { name: "claude-haiku-4-5", usd: 2.1 } },
    byProvider: { anthropic: 2.1 },
  },
]

const AGENTS = ["drafter", "reviewer", "ideator", "scheduler"]
const MODELS = ["claude-haiku-4-5", "gemini-2.5-flash"]

async function main() {
  ensureEmulator()
  const db = getAdminDb()
  const p = period()
  const now = new Date().toISOString()

  let gUsd = 0
  let gRuns = 0
  let gSucceeded = 0
  let gFailed = 0
  const gByModel: Record<string, number> = {}
  const gModelNames: Record<string, string> = {}
  const gByProvider: Record<string, number> = {}

  for (const org of ORGS) {
    const succeeded = org.runs - org.failed

    /* org doc + admin user */
    await db.doc(`organizations/${org.id}`).set(
      {
        id: org.id,
        name: org.name,
        slug: org.id,
        plan: org.plan,
        status: "active",
        onboarding: { completedAt: now },
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    )
    await db.doc(`organizations/${org.id}/users/admin`).set(
      { id: "admin", email: `admin@${org.id}.dev`, name: `${org.name} admin`, role: "admin", organizationId: org.id, createdAt: now, updatedAt: now },
      { merge: true },
    )

    /* org usage doc (authoritative for the reconciler) */
    const usdByModel: Record<string, number> = {}
    const usdByProvider: Record<string, number> = {}
    for (const [key, v] of Object.entries(org.byModel)) usdByModel[safeFieldKey(key)] = v.usd
    for (const [key, v] of Object.entries(org.byProvider)) usdByProvider[safeFieldKey(key)] = v
    await db.doc(`organizations/${org.id}/usage/${p}`).set(
      {
        period: p,
        organizationId: org.id,
        agentRuns: org.runs,
        agentRunsByOutcome: { succeeded, failed: org.failed },
        promptTokens: org.runs * 1800,
        completionTokens: org.runs * 600,
        cachedTokens: org.runs * 400,
        usdCost: org.usd,
        embeddingCalls: Math.round(org.runs * 0.5),
        usdByModel,
        usdByProvider,
        updatedAt: now,
      },
      { merge: true },
    )

    /* a handful of agentRuns for live-ops + tenant detail */
    for (let i = 0; i < 6; i++) {
      const runId = randomUUID()
      const isFailed = i === 0 && org.failed > 0
      const isRunning = i === 1
      const startedAt = new Date(Date.now() - i * 9 * 60_000).toISOString()
      const durationMs = 1500 + i * 700
      const model = MODELS[i % MODELS.length]
      await db.doc(`organizations/${org.id}/agentRuns/${runId}`).set({
        id: runId,
        organizationId: org.id,
        agentName: AGENTS[i % AGENTS.length],
        sessionId: runId,
        userId: "admin",
        trigger: "manual",
        status: isFailed ? "failed" : isRunning ? "in_progress" : "succeeded",
        provider: model.startsWith("claude") ? "anthropic" : "gemini",
        model,
        startedAt,
        finishedAt: isRunning ? undefined : startedAt,
        durationMs: isRunning ? undefined : durationMs,
        inputSummary: "demo run",
        outputs: { postIds: [], ideationItemIds: [] },
        error: isFailed ? { code: "agent_error", message: "demo: model timeout" } : undefined,
        metrics: { llmCalls: 2, toolCalls: 1, promptTokens: 1800, completionTokens: 600, cachedTokens: 400, usdCost: org.usd / org.runs },
        parentRunId: null,
        dedupKey: null,
        createdAt: startedAt,
        updatedAt: now,
      })
    }

    /* platform rollups (materialised so dashboards work immediately) */
    const byModelKeyed: Record<string, number> = {}
    const modelNamesKeyed: Record<string, string> = {}
    const byProviderKeyed: Record<string, number> = {}
    for (const [key, v] of Object.entries(org.byModel)) {
      const sk = safeFieldKey(key)
      byModelKeyed[sk] = v.usd
      modelNamesKeyed[sk] = v.name
      gByModel[sk] = (gByModel[sk] ?? 0) + v.usd
      gModelNames[sk] = v.name
    }
    for (const [key, v] of Object.entries(org.byProvider)) {
      const sk = safeFieldKey(key)
      byProviderKeyed[sk] = v
      gByProvider[sk] = (gByProvider[sk] ?? 0) + v
    }

    await db.doc(platformOrgRollupDocPath(org.id)).set({
      orgId: org.id,
      name: org.name,
      plan: org.plan,
      status: "active",
      seats: 1,
      mtdUsdCost: org.usd,
      mtdAgentRuns: org.runs,
      failureRate: org.failed / org.runs,
      onboardingCompletedAt: now,
      lastRunAt: now,
      updatedAt: now,
    })
    await db.doc(platformOrgRollupPeriodDocPath(org.id, p)).set({
      period: p,
      usdCost: org.usd,
      agentRuns: org.runs,
      runsByOutcome: { succeeded, failed: org.failed },
      byModel: byModelKeyed,
      modelNames: modelNamesKeyed,
      byProvider: byProviderKeyed,
      updatedAt: now,
    })
    /* 14 days of daily history so the spend-trend chart shows a real curve.
     * Deterministic variation (no Math.random) keyed off the day index. */
    for (let day = 0; day < 14; day++) {
      const date = new Date(Date.now() - day * 86_400_000).toISOString().slice(0, 10)
      const factor = 0.6 + 0.4 * Math.abs(Math.sin((day + org.name.length) / 2))
      const dayUsd = Math.round((org.usd / 14) * factor * 100) / 100
      const dayRuns = Math.round((org.runs / 14) * factor)
      const scaledModel: Record<string, number> = {}
      const scaledProvider: Record<string, number> = {}
      for (const [k, v] of Object.entries(byModelKeyed)) scaledModel[k] = Math.round((v / 14) * factor * 100) / 100
      for (const [k, v] of Object.entries(byProviderKeyed)) scaledProvider[k] = Math.round((v / 14) * factor * 100) / 100
      await db.doc(platformOrgRollupDailyDocPath(org.id, date)).set({
        date,
        orgId: org.id,
        usdCost: dayUsd,
        agentRuns: dayRuns,
        byModel: scaledModel,
        byProvider: scaledProvider,
        updatedAt: now,
      })
    }

    gUsd += org.usd
    gRuns += org.runs
    gSucceeded += succeeded
    gFailed += org.failed
    console.log(`→ seeded ${org.name} (${org.plan}) - ${org.usd} usd, ${org.runs} runs`)
  }

  await db.doc(platformRollupDocPath(p)).set({
    period: p,
    usdCost: gUsd,
    agentRuns: gRuns,
    promptTokens: gRuns * 1800,
    completionTokens: gRuns * 600,
    cachedTokens: gRuns * 400,
    embeddingCalls: Math.round(gRuns * 0.5),
    runsByOutcome: { succeeded: gSucceeded, failed: gFailed },
    byModel: gByModel,
    modelNames: gModelNames,
    byProvider: gByProvider,
    activeOrgs: ORGS.length,
    updatedAt: now,
  })
  console.log(`\nplatform demo seed complete - global ${gUsd.toFixed(2)} usd / ${gRuns} runs.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
