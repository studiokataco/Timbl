"use server"

import { z } from "zod"

import { getAdminDb } from "@/lib/firebase/admin"
import { requirePlatformAdmin } from "@/lib/auth/platform-guard"
import { can } from "@/lib/auth/platform-rbac"
import { writePlatformAudit } from "@/lib/platform/audit"
import {
  platformSignupRequestDocPath,
  signupRequestSchema,
} from "@/lib/platform/schema"
import { bootstrapNewOrg } from "@/lib/org/bootstrap"
import { FREE_PLAN_ID, TRIAL_DAYS, TRIAL_PLAN_ID } from "@/lib/plans/plans"
import { orgIdForNewWorkspace } from "@/lib/auth/domains"
import { orgUsersPath } from "@/lib/firebase/paths"
import { slugify } from "@/lib/auth/membership"
import { sendInviteAcceptedEmail } from "@/lib/email/beta"
import { FieldValue } from "firebase-admin/firestore"
import type { PlatformActionResult } from "@/lib/actions/platform/orgs"

const idInput = z.object({ id: z.string().min(1) })

export async function approveSignupRequest(raw: unknown): Promise<PlatformActionResult> {
  const actor = await requirePlatformAdmin()
  if (!can(actor, "signups:review")) return { ok: false, error: "forbidden" }

  const parsed = idInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { id } = parsed.data

  const db = getAdminDb()
  const ref = db.doc(platformSignupRequestDocPath(id))
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: "not_found" }

  const req = signupRequestSchema.safeParse({ ...snap.data(), id })
  if (!req.success) return { ok: false, error: "invalid_request_data" }
  if (req.data.status !== "pending") return { ok: false, error: "already_decided" }

  const { email, name } = req.data
  const orgId = orgIdForNewWorkspace(email)
  const orgRef = db.doc(`organizations/${orgId}`)

  if (!(await orgRef.get()).exists) {
    await bootstrapNewOrg({ orgId, name: name })
  }

  /* bootstrapNewOrg lands the org on Free, where agentRuns and the agent
   * budget are both 0 - an approved tenant could not run a single agent, so
   * the first thing they tried (usually awareness research) failed on a plan
   * gate. Approval grants the standard 30-day trial instead; the plan they
   * asked for is kept as pendingPlan for the billing conversion. Guarded so
   * re-approving or approving a second user never restarts a spent trial. */
  const orgData = (await orgRef.get()).data() ?? {}
  const nowIso = new Date().toISOString()
  const grantTrial =
    !orgData.trialStartedAt &&
    ((orgData.plan as string | undefined) ?? FREE_PLAN_ID) === FREE_PLAN_ID

  await orgRef.set(
    {
      ...(req.data.plan ? { pendingPlan: req.data.plan } : {}),
      ...(grantTrial
        ? {
            plan: TRIAL_PLAN_ID,
            billingStatus: "trialing",
            trialStartedAt: nowIso,
            trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString(),
            updatedAt: nowIso,
          }
        : {}),
    },
    { merge: true },
  )

  const userId = slugify(email.split("@")[0])
  await db.doc(`${orgUsersPath(orgId)}/${userId}`).set(
    {
      id: userId,
      email,
      name,
      role: "admin",
      organizationId: orgId,
      active: true,
      provisionedAt: FieldValue.serverTimestamp(),
      provisionedVia: "invite-approved",
    },
    { merge: true },
  )

  const now = new Date().toISOString()
  await ref.set(
    { status: "approved", decidedAt: now, decidedBy: actor.email, orgId },
    { merge: true },
  )

  await writePlatformAudit({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "signup.approve",
    targetOrgId: orgId,
    meta: { requestId: id, email, orgId, trialGranted: grantTrial },
  })

  await sendInviteAcceptedEmail({ email, name })
  return { ok: true }
}

export async function denySignupRequest(raw: unknown): Promise<PlatformActionResult> {
  const actor = await requirePlatformAdmin()
  if (!can(actor, "signups:review")) return { ok: false, error: "forbidden" }

  const parsed = idInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_input" }
  const { id } = parsed.data

  const db = getAdminDb()
  const ref = db.doc(platformSignupRequestDocPath(id))
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: "not_found" }

  const req = signupRequestSchema.safeParse({ ...snap.data(), id })
  if (!req.success) return { ok: false, error: "invalid_request_data" }
  if (req.data.status !== "pending") return { ok: false, error: "already_decided" }

  const now = new Date().toISOString()
  await ref.set({ status: "denied", decidedAt: now, decidedBy: actor.email }, { merge: true })

  await writePlatformAudit({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: "signup.deny",
    meta: { requestId: id, email: req.data.email },
  })
  return { ok: true }
}
