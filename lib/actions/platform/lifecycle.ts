"use server"

import { FieldValue } from "firebase-admin/firestore"
import { z } from "zod"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgPath } from "@/lib/firebase/paths"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { writePlatformAudit } from "@/lib/platform/audit"
import { FREE_PLAN_ID, TRIAL_DAYS, TRIAL_PLAN_ID } from "@/lib/plans/plans"

import type { PlatformActionResult } from "./orgs"

const trialInput = z.object({
  orgId: z.string().min(1),
  action: z.enum(["start", "extend", "cancel"]),
})

const TRIAL_MS = TRIAL_DAYS * 86_400_000

/*
 * Operator trial control. Unlike the tenant-facing startTrial (lib/actions/
 * billing.ts), this bypasses the one-per-org and no-subscription guards - an
 * operator can grant, extend, or revoke a trial regardless of history. Lazy
 * expiry in lib/plans/gate.ts still reverts an over-due trial to Free.
 */
export async function setTrial(raw: unknown): Promise<PlatformActionResult> {
  const actor = await requirePlatformAdmin()
  if (actor.role !== "owner") return { ok: false, error: "forbidden" }
  const parsed = trialInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { orgId, action } = parsed.data

  const ref = getAdminDb().doc(orgPath(orgId))
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: "org_not_found" }

  const now = new Date()
  const nowIso = now.toISOString()

  if (action === "start") {
    const ends = new Date(now.getTime() + TRIAL_MS).toISOString()
    await ref.set(
      {
        plan: TRIAL_PLAN_ID,
        billingStatus: "trialing",
        trialStartedAt: nowIso,
        trialEndsAt: ends,
        updatedAt: nowIso,
      },
      { merge: true },
    )
    await writePlatformAudit({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "trial.start",
      targetOrgId: orgId,
      meta: { trialEndsAt: ends },
    })
    return { ok: true }
  }

  if (action === "extend") {
    const current = snap.data()?.trialEndsAt as string | undefined
    const base =
      current && Date.parse(current) > now.getTime() ? Date.parse(current) : now.getTime()
    const ends = new Date(base + TRIAL_MS).toISOString()
    await ref.set(
      { billingStatus: "trialing", trialEndsAt: ends, updatedAt: nowIso },
      { merge: true },
    )
    await writePlatformAudit({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "trial.extend",
      targetOrgId: orgId,
      meta: { from: current ?? null, to: ends },
    })
    return { ok: true }
  }

  await ref.set(
    {
      plan: FREE_PLAN_ID,
      billingStatus: "manual",
      trialEndsAt: FieldValue.delete(),
      updatedAt: nowIso,
    },
    { merge: true },
  )
  await writePlatformAudit({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "trial.cancel",
    targetOrgId: orgId,
  })
  return { ok: true }
}

const grandfatherInput = z.object({
  orgId: z.string().min(1),
  value: z.boolean(),
})

export async function setGrandfathered(raw: unknown): Promise<PlatformActionResult> {
  const actor = await requirePlatformAdmin()
  if (actor.role !== "owner") return { ok: false, error: "forbidden" }
  const parsed = grandfatherInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { orgId, value } = parsed.data

  const ref = getAdminDb().doc(orgPath(orgId))
  if (!(await ref.get()).exists) return { ok: false, error: "org_not_found" }

  const now = new Date().toISOString()
  await ref.set(
    value
      ? { grandfathered: true, grandfatheredAt: now, updatedAt: now }
      : {
          grandfathered: FieldValue.delete(),
          grandfatheredAt: FieldValue.delete(),
          updatedAt: now,
        },
    { merge: true },
  )
  await writePlatformAudit({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "grandfather.set",
    targetOrgId: orgId,
    meta: { value },
  })
  return { ok: true }
}
