"use server"

import { getAdminDb } from "@/lib/firebase/admin"
import { platformSignupRequestDocPath, platformSignupRequestsPath } from "@/lib/platform/schema"
import { signupRequestFormSchema } from "@/lib/schemas/signupRequest"
import type { ServerActionResult } from "@/lib/schemas"

export async function submitInviteRequest(raw: unknown): Promise<ServerActionResult> {
  const parsed = signupRequestFormSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const { name, email, company, useCase } = parsed.data
  const db = getAdminDb()

  const norm = email.trim().toLowerCase()
  const existing = await db
    .collection(platformSignupRequestsPath)
    .where("email", "==", norm)
    .where("status", "==", "pending")
    .limit(1)
    .get()
  if (!existing.empty) {
    return { ok: true, id: existing.docs[0].id }
  }

  const ref = db.collection(platformSignupRequestsPath).doc()
  await ref.set({
    id: ref.id,
    email: norm,
    name: name.trim(),
    company: company?.trim() ?? null,
    useCase: useCase?.trim() ?? null,
    status: "pending",
    requestedAt: new Date().toISOString(),
    decidedAt: null,
    decidedBy: null,
    orgId: null,
  })
  return { ok: true, id: ref.id }
}
