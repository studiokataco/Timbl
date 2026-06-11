import { onSchedule } from "firebase-functions/v2/scheduler"
import { defineSecret, defineString } from "firebase-functions/params"
import { logger } from "firebase-functions"

/*
 * Model-update check - notify-only (§6.8 of the pluggable-providers phase).
 *
 * Fires on the 1st and 15th of each month (≈ bi-weekly) and POSTs to the
 * Next app's /api/agents/model-update-check route, which diffs each
 * provider's live model list against the models in use + the §4 shortlist
 * and writes modelUpdates notifications. Nothing is auto-applied - a human
 * reviews flagged models in Studio.
 *
 * Sibling of agentSweep.ts; reuses the same shared-secret auth and the
 * APP_BASE_URL param.
 */

const APP_BASE_URL = defineString("APP_BASE_URL", {
  description: "Public origin of the Next app (production: https://timbl.app)",
  default: "https://timbl.app",
})
const CRON_SECRET = defineSecret("AGENT_CRON_SECRET")

export const modelUpdateCheck = onSchedule(
  {
    schedule: "0 9 1,15 * *",
    timeZone: "UTC",
    secrets: [CRON_SECRET],
    region: "asia-south1",
    timeoutSeconds: 120,
    retryCount: 0,
  },
  async () => {
    const baseUrl = APP_BASE_URL.value()
    const secret = CRON_SECRET.value()
    try {
      const res = await fetch(`${baseUrl}/api/agents/model-update-check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Cron-Secret": secret,
        },
      })
      const body = await res.text().catch(() => "")
      if (!res.ok) {
        logger.error("[modelUpdateCheck] dispatch failed", {
          status: res.status,
          detail: body.slice(0, 300),
        })
        return
      }
      logger.info("[modelUpdateCheck] done", { detail: body.slice(0, 300) })
    } catch (err) {
      logger.error("[modelUpdateCheck] dispatch error", {
        message: err instanceof Error ? err.message : String(err),
      })
    }
  },
)
