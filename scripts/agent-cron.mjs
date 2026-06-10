#!/usr/bin/env node
import cron from "node-cron"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import * as adminApp from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

/*
 * Local agent-cron driver. Reads every enabled agentConfig with a cron
 * `schedule` for the dev demo org, registers a node-cron job per agent,
 * and POSTs to /api/agents/cron/tick when each job fires.
 *
 * Started from scripts/dev.mjs only when AGENTS_CRON=1 is set in the
 * environment. In Phase 7 we replace this with Cloud Scheduler hitting
 * the same /tick endpoint.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const NEXT_BASE = process.env.AGENT_CRON_BASE_URL ?? "http://127.0.0.1:3000"
const SECRET = process.env.AGENT_CRON_SECRET
const ORG_ID = process.env.AGENT_CRON_ORG_ID ?? "safe-foundation"

if (!SECRET) {
  console.error(
    "[agents] AGENT_CRON_SECRET is not set. Configure it in .env.local before starting the cron process.",
  )
  process.exit(1)
}

function resolveProjectId() {
  try {
    const rc = JSON.parse(readFileSync(path.join(REPO_ROOT, ".firebaserc"), "utf8"))
    return rc?.projects?.default
  } catch {
    return undefined
  }
}

function initAdmin() {
  if (adminApp.getApps().length > 0) return
  const projectId = resolveProjectId() ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  adminApp.initializeApp({ projectId })
}

async function fetchSchedules() {
  initAdmin()
  const db = getFirestore()
  const snap = await db
    .collection(`organizations/${ORG_ID}/agentConfigs`)
    .where("enabled", "==", true)
    .get()
  const out = []
  for (const d of snap.docs) {
    const data = d.data()
    if (!data?.schedule) continue
    if (!data?.triggers?.cron) continue
    if (!cron.validate(data.schedule)) {
      console.warn(`[agents] invalid cron for ${d.id}: ${data.schedule}`)
      continue
    }
    out.push({ name: d.id, schedule: data.schedule })
  }
  return out
}

async function fireTick(agentName) {
  const url = `${NEXT_BASE}/api/agents/cron/tick`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Cron-Secret": SECRET,
      },
      body: JSON.stringify({
        orgId: ORG_ID,
        agentName,
        input: `scheduled run @ ${new Date().toISOString()}`,
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      console.error(`[agents] ${agentName}: tick failed (${res.status}) ${text}`)
      return
    }
    const json = await res.json()
    if (json.skipped) {
      console.log(`[agents] ${agentName}: skipped (${json.reason})`)
    } else if (json.started) {
      console.log(`[agents] ${agentName}: started ${json.started.runId}`)
    }
  } catch (err) {
    console.error(
      `[agents] ${agentName}: tick error`,
      err instanceof Error ? err.message : err,
    )
  }
}

async function main() {
  const schedules = await fetchSchedules()
  if (schedules.length === 0) {
    console.log("[agents] no scheduled agents - exiting (set a schedule in /settings/agents to enable)")
    return
  }
  console.log(`[agents] scheduling ${schedules.length} agent(s):`)
  for (const s of schedules) {
    console.log(`[agents]   - ${s.name}  ${s.schedule}`)
    cron.schedule(s.schedule, () => fireTick(s.name))
  }
  /* keep the process alive - node-cron doesn't pin the event loop on
   * its own. */
  setInterval(() => undefined, 1 << 30)
}

main().catch((err) => {
  console.error("[agents] fatal", err)
  process.exit(1)
})
