import { BaseLlm } from "@google/adk"
import type { LlmRequest, LlmResponse } from "@google/adk"

import { getAdminDb } from "@/lib/firebase/admin"
import {
  orgAwarenessProposalsPath,
  orgPath,
  orgUsageDocPath,
} from "@/lib/firebase/paths"
import { proposeAwarenessDayTool } from "@/lib/agents/tools/awareness-research"
import { RUNTIME_STATE_KEY } from "@/lib/agents/runtime/context"
import { emitAgentRun } from "@/lib/telemetry/agent-events"
import { PlanGateError, requireAgentBudget } from "@/lib/plans/gate"
import { getPlan } from "@/lib/plans/plans"
import { ResilientLlm } from "@/lib/agents/runtime/resilient-llm"

/*
 * Smoke test for the awareness-researcher availability fixes, against the
 * emulator. Covers the failure modes that made the agent unusable: quota
 * consumed by runs that never reached a model, a provider quota error with
 * nowhere to fail over to, and proposals written from an ungrounded model's
 * memory - fabricated citations and the same day twice.
 *
 * Needs a grounding-capable key in the environment (OPENROUTER_API_KEY or
 * GEMINI_API_KEY) for the proposal checks: the tool refuses to write at all
 * without one, which is itself correct behaviour.
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 pnpm verify:agent-quota
 */

const ORG = "_agent_quota_smoke_test"
const AGENT = "awareness-researcher"

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`)
  console.log(`  ok - ${msg}`)
}

function period(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

async function runsForAgent(): Promise<number> {
  const snap = await getAdminDb().doc(orgUsageDocPath(ORG, period())).get()
  const map = (snap.data()?.agentRunsByAgent ?? {}) as Record<string, number>
  return map[AGENT] ?? 0
}

async function reset() {
  const db = getAdminDb()
  await db.doc(orgUsageDocPath(ORG, period())).delete()
  await db.doc(orgPath(ORG)).set({ id: ORG, plan: "agency_v1" }, { merge: true })
}

class ThrowingLlm extends BaseLlm {
  constructor(private readonly error: unknown) {
    super({ model: "primary-under-test" })
  }
  override async *generateContentAsync(): AsyncGenerator<LlmResponse, void> {
    throw this.error
  }
  override async connect(): Promise<never> {
    throw new Error("not supported")
  }
}

class EchoLlm extends BaseLlm {
  constructor() {
    super({ model: "fallback-under-test" })
  }
  override async *generateContentAsync(): AsyncGenerator<LlmResponse, void> {
    yield {
      content: { role: "model", parts: [{ text: "from-fallback" }] },
      turnComplete: true,
    } as LlmResponse
  }
  override async connect(): Promise<never> {
    throw new Error("not supported")
  }
}

async function main() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("FIRESTORE_EMULATOR_HOST is not set - refusing to run against real Firestore.")
  }

  console.log("\n1. A failed run that burned no tokens leaves the per-agent cap alone")
  await reset()
  await emitAgentRun({
    orgId: ORG,
    runId: "r1",
    agentName: AGENT,
    outcome: "failed",
    promptTokens: 0,
    completionTokens: 0,
    chargeable: false,
  })
  assert((await runsForAgent()) === 0, "provider 429 with no tokens does not consume an invocation")

  console.log("\n2. Real work still consumes the cap")
  await emitAgentRun({
    orgId: ORG,
    runId: "r2",
    agentName: AGENT,
    outcome: "succeeded",
    promptTokens: 1_200,
    completionTokens: 400,
    chargeable: true,
  })
  await emitAgentRun({
    orgId: ORG,
    runId: "r3",
    agentName: AGENT,
    outcome: "failed",
    promptTokens: 900,
    completionTokens: 0,
    chargeable: true,
  })
  assert((await runsForAgent()) === 2, "a succeeded run and a failed run that reached the model both count")

  console.log("\n3. The cap still binds once genuinely spent")
  const cap = getPlan("agency_v1").agentInvocationCaps[AGENT]
  assert(typeof cap === "number" && cap > 3, `agency cap is a workable number (${cap})`)
  await getAdminDb()
    .doc(orgUsageDocPath(ORG, period()))
    .set({ agentRunsByAgent: { [AGENT]: cap as number } }, { merge: true })
  let gated = false
  try {
    await requireAgentBudget(ORG, AGENT, 0)
  } catch (err) {
    gated = err instanceof PlanGateError && err.reason.kind === "agentInvocations"
  }
  assert(gated, "requireAgentBudget still refuses the run at the cap")

  console.log("\n4. A provider quota error fails over instead of failing the run")
  const quotaError = Object.assign(new Error("429 RESOURCE_EXHAUSTED - retryDelay: 41s"), {
    status: 429,
  })
  const resilient = new ResilientLlm({
    primary: new ThrowingLlm(quotaError),
    fallback: new EchoLlm(),
    label: "primary",
    fallbackLabel: "fallback",
  })
  const chunks: string[] = []
  for await (const res of resilient.generateContentAsync({} as LlmRequest, false)) {
    for (const part of res.content?.parts ?? []) {
      if (part.text) chunks.push(part.text)
    }
  }
  assert(chunks.join("") === "from-fallback", "exhausted primary hands the request to the fallback")

  console.log("\n5. A non-transient error is not retried or absorbed")
  const badKey = Object.assign(new Error("401 invalid api key"), { status: 401 })
  let threw = false
  try {
    const r = new ResilientLlm({
      primary: new ThrowingLlm(badKey),
      fallback: new EchoLlm(),
      label: "primary",
    })
    for await (const _ of r.generateContentAsync({} as LlmRequest, false)) void _
  } catch {
    threw = true
  }
  assert(threw, "a bad credential surfaces rather than silently switching provider")

  console.log("\n6. A proposal cited only by a search-redirect handle is refused")
  const db = getAdminDb()
  const proposals = db.collection(orgAwarenessProposalsPath(ORG))
  for (const doc of (await proposals.get()).docs) await doc.ref.delete()

  /* adk-js hands tools a ToolContext whose `state` is a Map-like store.
   * Only the keys getRuntimeCtx demands need to be present. */
  const toolContext = {
    state: {
      get: (key: string) =>
        key === RUNTIME_STATE_KEY
          ? {
              orgId: ORG,
              userId: "smoke-user",
              runId: "r-smoke",
              agentName: AGENT,
              brandId: "default",
            }
          : undefined,
    },
  }

  const propose = (item: Record<string, unknown>) =>
    proposeAwarenessDayTool.runAsync({
      args: item,
      toolContext,
    } as never) as Promise<{ ok: boolean; error?: string; proposalId?: string }>

  const proxyCite = await propose({
    date: "2026-09-10",
    name: "World Suicide Prevention Day",
    sourceUrls: [
      "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEibg2-3dexkWI6S536",
    ],
    importance: "high",
    recurringPattern: "annual",
  })
  assert(proxyCite.ok === false, "grounding-redirect handle is not accepted as a source")
  assert((await proposals.get()).size === 0, "nothing was written for the refused proposal")

  console.log("\n7. A real citation is accepted")
  const good = await propose({
    date: "2026-09-10",
    name: "World Suicide Prevention Day",
    sourceUrls: ["https://www.who.int/campaigns/world-suicide-prevention-day"],
    importance: "high",
    recurringPattern: "annual",
  })
  assert(good.ok === true, "a real source URL is accepted")

  console.log("\n8. The same day proposed twice is refused")
  const dupe = await propose({
    date: "2026-09-10",
    name: "World Suicide Prevention day!",
    sourceUrls: ["https://www.who.int/campaigns/world-suicide-prevention-day"],
    importance: "high",
    recurringPattern: "annual",
  })
  assert(dupe.ok === false, "a repeat of a proposed day is refused across punctuation and case")
  assert((await proposals.get()).size === 1, "the duplicate never reached Firestore")

  for (const doc of (await proposals.get()).docs) await doc.ref.delete()
  await db.doc(orgUsageDocPath(ORG, period())).delete()
  await db.doc(orgPath(ORG)).delete()
  console.log("\nAll agent quota and proposal checks passed.\n")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
