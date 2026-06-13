"use server"

import { getAdminDb } from "@/lib/firebase/admin"
import { platformSignupRequestsPath } from "@/lib/platform/schema"
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
    status: "pending",
    requestedAt: now,
  })
  return { ok: true, id: ref.id }
}
