"use server"

import { LEGAL } from "@/lib/constants/legal"
import { sendSignupRequestedEmail } from "@/lib/email/beta"
import { getAdminDb } from "@/lib/firebase/admin"
import { platformConsentDocPath, platformSignupRequestsPath } from "@/lib/platform/schema"
import { writePlatformSignal } from "@/lib/platform/signals"
import { signupRequestFormSchema } from "@/lib/schemas/signupRequest"
import type { ServerActionResult } from "@/lib/schemas"

export async function submitInviteRequest(raw: unknown): Promise<ServerActionResult> {
  const parsed = signupRequestFormSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const { name, email, company, useCase, plan } = parsed.data
  const db = getAdminDb()

  const norm = email.trim().toLowerCase()
  const existing = await db
    .collection(platformSignupRequestsPath)
    .where("email", "==", norm)
    .limit(5)
    .get()
  const pending = existing.docs.find((d) => d.data().status === "pending")
  if (pending) {
    return { ok: true, id: pending.id }
  }

  const ref = db.collection(platformSignupRequestsPath).doc()
  const now = new Date().toISOString()
  await ref.set({
    id: ref.id,
    email: norm,
    name: name.trim(),
    ...(company?.trim() ? { company: company.trim() } : {}),
    ...(useCase?.trim() ? { useCase: useCase.trim() } : {}),
    ...(plan ? { plan } : {}),
    status: "pending",
    requestedAt: now,
    acceptedTerms: true,
    acceptedAt: now,
    acceptedPolicyVersion: LEGAL.policyVersion,
  })

  await db.doc(platformConsentDocPath(norm)).set(
    {
      email: norm,
      acceptedTerms: true,
      acceptedAt: now,
      policyVersion: LEGAL.policyVersion,
      context: "invite_request",
    },
    { merge: true },
  )

  void writePlatformSignal({
    id: `signup-${ref.id}`,
    kind: "signup.requested",
    summary: `New signup request from ${norm}`,
    meta: {
      requestId: ref.id,
      email: norm,
      name: name.trim(),
      ...(company?.trim() ? { company: company.trim() } : {}),
      ...(useCase?.trim() ? { useCase: useCase.trim() } : {}),
      ...(plan ? { plan } : {}),
    },
  }).catch(() => {})

  await sendSignupRequestedEmail({
    name: name.trim(),
    email: norm,
    ...(company?.trim() ? { company: company.trim() } : {}),
    ...(useCase?.trim() ? { useCase: useCase.trim() } : {}),
  })

  return { ok: true, id: ref.id }
}
