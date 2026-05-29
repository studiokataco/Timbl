import { onSchedule } from "firebase-functions/v2/scheduler"
import { defineSecret, defineString } from "firebase-functions/params"
import { logger } from "firebase-functions"
import { getFirestore } from "firebase-admin/firestore"

/*
 * Publish sweep — clones agentSweep's shape. Fires once a minute and POSTs
 * /api/publish/tick for every org. The tick endpoint loads each org's due
 * scheduled posts and publishes them; it's idempotent per channel so a
 * duplicate hit across a minute boundary is safe.
 */

const APP_BASE_URL = defineString("APP_BASE_URL", {
  description: "Public origin of the Next app",
  default: "https://safe-planner--sm-dashboard-e7641.asia-east1.hosted.app",
})
const PUBLISH_SECRET = defineSecret("PUBLISH_SWEEP_SECRET")

export const publishSweep = onSchedule(
  {
    schedule: "* * * * *",
    timeZone: "UTC",
    secrets: [PUBLISH_SECRET],
    region: "asia-south1",
    timeoutSeconds: 120,
    retryCount: 0,
  },
  async (event) => {
    const baseUrl = APP_BASE_URL.value()
    const secret = PUBLISH_SECRET.value()
    const db = getFirestore()
    const orgs = await db.collection("organizations").get()
    let dispatched = 0

    for (const org of orgs.docs) {
      try {
        const res = await fetch(`${baseUrl}/api/publish/tick`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Publish-Secret": secret,
          },
          body: JSON.stringify({ orgId: org.id }),
        })
        if (!res.ok) {
          const text = await res.text().catch(() => "")
          logger.error("[publishSweep] dispatch failed", {
            org: org.id,
            status: res.status,
            detail: text.slice(0, 200),
          })
          continue
        }
        dispatched++
      } catch (err) {
        logger.error("[publishSweep] dispatch error", {
          org: org.id,
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }

    logger.info("[publishSweep] tick", {
      dispatched,
      at: new Date(event.scheduleTime).toISOString(),
    })
  },
)
