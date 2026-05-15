import { onSchedule } from "firebase-functions/v2/scheduler"
import { defineSecret, defineString } from "firebase-functions/params"
import { logger } from "firebase-functions"
import { getFirestore } from "firebase-admin/firestore"
import { CronExpressionParser } from "cron-parser"

/*
 * Sweep function — production replacement for scripts/agent-cron.mjs.
 *
 * Fires once a minute. Loads every enabled agent in every org, evaluates
 * the agent's cron schedule against the current minute, and POSTs to
 * /api/agents/cron/tick for each agent that's due. The tick endpoint
 * enforces single-flight per agent on its own, so duplicate hits across a
 * minute boundary are safe.
 */

const APP_BASE_URL = defineString("APP_BASE_URL", {
  description: "Public origin of the Next app, e.g. https://sm-dashboard-e7641--*.a.run.app",
  default: "https://sm-dashboard-e7641.web.app",
})
const CRON_SECRET = defineSecret("AGENT_CRON_SECRET")
const SWEEP_TOLERANCE_SECONDS = 30

export const agentSweep = onSchedule(
  {
    schedule: "* * * * *",
    timeZone: "UTC",
    secrets: [CRON_SECRET],
    region: "us-central1",
    timeoutSeconds: 60,
    retryCount: 0,
  },
  async (event) => {
    const now = new Date(event.scheduleTime)
    const baseUrl = APP_BASE_URL.value()
    const secret = CRON_SECRET.value()

    const db = getFirestore()
    const orgs = await db.collection("organizations").get()
    let dispatched = 0
    let evaluated = 0

    for (const org of orgs.docs) {
      const configs = await db
        .collection(`organizations/${org.id}/agentConfigs`)
        .where("enabled", "==", true)
        .get()

      for (const cfg of configs.docs) {
        evaluated++
        const data = cfg.data()
        if (!data?.schedule || data?.triggers?.cron !== true) continue
        if (!shouldFire(data.schedule, now)) continue

        try {
          const res = await fetch(`${baseUrl}/api/agents/cron/tick`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Agent-Cron-Secret": secret,
            },
            body: JSON.stringify({
              orgId: org.id,
              agentName: cfg.id,
              input: `scheduled run @ ${now.toISOString()}`,
            }),
          })
          if (!res.ok) {
            const text = await res.text().catch(() => "")
            logger.error("[agentSweep] dispatch failed", {
              org: org.id,
              agent: cfg.id,
              status: res.status,
              detail: text.slice(0, 200),
            })
            continue
          }
          dispatched++
        } catch (err) {
          logger.error("[agentSweep] dispatch error", {
            org: org.id,
            agent: cfg.id,
            message: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    logger.info("[agentSweep] tick", {
      evaluated,
      dispatched,
      at: now.toISOString(),
    })
  },
)

function shouldFire(schedule: string, now: Date): boolean {
  try {
    const parsed = CronExpressionParser.parse(schedule, {
      currentDate: new Date(now.getTime() - 60_000),
      tz: "UTC",
    })
    const next = parsed.next().toDate()
    const drift = Math.abs(next.getTime() - now.getTime()) / 1000
    return drift <= SWEEP_TOLERANCE_SECONDS
  } catch {
    return false
  }
}
