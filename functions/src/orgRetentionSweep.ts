import { onSchedule } from "firebase-functions/v2/scheduler"
import { logger } from "firebase-functions"
import { getFirestore } from "firebase-admin/firestore"

/*
 * Hard-delete stage of workspace retirement. Suspension (control centre)
 * stamps `suspendedAt` on the org doc; once an org has been suspended for
 * RETENTION_DAYS it is permanently deleted - org tree, platform rollups,
 * billing profile. Reactivating clears `suspendedAt` and cancels the clock.
 *
 * Orgs suspended without a `suspendedAt` stamp (pre-feature data) are
 * skipped, never deleted - destructive automation only acts on explicit
 * evidence.
 *
 * Path strings inlined - functions/ can't import @/lib. Keep in sync with
 * lib/platform/schema.ts.
 */

const RETENTION_DAYS = 60

export const orgRetentionSweep = onSchedule(
  {
    schedule: "0 2 * * *",
    timeZone: "UTC",
    retryCount: 0,
    timeoutSeconds: 540,
  },
  async () => {
    const db = getFirestore()
    const cutoff = new Date(
      Date.now() - RETENTION_DAYS * 86_400_000,
    ).toISOString()
    const snap = await db
      .collection("organizations")
      .where("status", "==", "suspended")
      .get()

    let deleted = 0
    for (const doc of snap.docs) {
      const suspendedAt = doc.data().suspendedAt as string | undefined
      if (!suspendedAt || suspendedAt > cutoff) continue
      const orgId = doc.id
      try {
        const auditRef = db.collection("platform/state/auditLog").doc()
        await auditRef.set({
          id: auditRef.id,
          actorUid: "system",
          actorEmail: "system@timbl",
          action: "org.auto_delete",
          targetOrgId: orgId,
          target: null,
          meta: {
            name: (doc.data().name as string) ?? orgId,
            suspendedAt,
            retentionDays: RETENTION_DAYS,
          },
          createdAt: new Date().toISOString(),
        })
        await db.recursiveDelete(doc.ref)
        await db.recursiveDelete(db.doc(`platform/state/orgRollups/${orgId}`))
        await db.doc(`platform/state/billing/${orgId}`).delete()
        deleted++
        logger.info("[orgRetentionSweep] deleted", { orgId, suspendedAt })
      } catch (err) {
        logger.error("[orgRetentionSweep] delete failed", {
          orgId,
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }

    logger.info("[orgRetentionSweep] done", {
      suspendedScanned: snap.size,
      deleted,
    })
  },
)
