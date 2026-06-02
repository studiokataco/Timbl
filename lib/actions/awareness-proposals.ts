"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getCurrentOrgId, getDb } from "@/lib/auth/server-helpers"
import {
  awarenessDaysPath,
  orgAwarenessProposalsPath,
} from "@/lib/firebase/paths"
import { snapToData, type WithId } from "@/lib/firebase/serialize"

/*
 * Server actions for the awareness-day proposals queue.
 *
 * - listProposals: returns proposals for the current org, default
 *   filtered to status="proposed". Newest first by createdAt.
 * - acceptProposal: copies the proposal into the official global
 *   awarenessDays collection, then marks the proposal accepted.
 * - rejectProposal: marks the proposal rejected (kept for audit).
 */

export type AwarenessProposalStatus = "proposed" | "accepted" | "rejected"

export interface AwarenessProposal {
  id: string
  organizationId: string
  date: string
  name: string
  description: string | null
  sourceUrls: string[]
  importance: "low" | "medium" | "high"
  recurringPattern: "annual" | "weekly" | "fixed-date" | "custom"
  proposed: boolean
  status: AwarenessProposalStatus
  agentRunId?: string | null
  createdAt: string
  updatedAt: string
}

const listSchema = z.object({
  status: z
    .enum(["proposed", "accepted", "rejected"])
    .optional()
    .default("proposed"),
})

export async function listProposals(
  input: z.input<typeof listSchema> = {},
): Promise<WithId<AwarenessProposal>[]> {
  const parsed = listSchema.parse(input)
  const orgId = await getCurrentOrgId()
  const snap = await getDb()
    .collection(orgAwarenessProposalsPath(orgId))
    .where("status", "==", parsed.status)
    .orderBy("createdAt", "desc")
    .get()
  return snap.docs.map((d) => snapToData<AwarenessProposal>(d))
}

const idSchema = z.object({ id: z.string().min(1) })

type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string }

export async function acceptProposal(
  input: unknown,
): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }
  }
  const orgId = await getCurrentOrgId()
  const db = getDb()

  const proposalRef = db.doc(
    `${orgAwarenessProposalsPath(orgId)}/${parsed.data.id}`,
  )
  const snap = await proposalRef.get()
  if (!snap.exists) return { ok: false, error: "Proposal not found" }
  const data = snap.data() as Partial<AwarenessProposal> | undefined
  if (!data?.date || !data.name) {
    return { ok: false, error: "Proposal is missing required fields" }
  }
  if (data.status === "accepted") {
    return { ok: true, id: parsed.data.id }
  }

  const dayRef = db.collection(awarenessDaysPath).doc()
  const now = new Date().toISOString()
  const batch = db.batch()
  batch.set(dayRef, {
    id: dayRef.id,
    date: data.date,
    name: data.name,
    description: data.description ?? undefined,
    sourceUrl: data.sourceUrls?.[0] ?? undefined,
    importance: data.importance ?? "medium",
    recurringPattern: data.recurringPattern ?? "annual",
    createdAt: now,
    updatedAt: now,
  })
  batch.update(proposalRef, {
    status: "accepted",
    acceptedAwarenessDayId: dayRef.id,
    updatedAt: now,
  })
  await batch.commit()

  revalidatePath("/awareness")
  return { ok: true, id: dayRef.id }
}

export async function rejectProposal(
  input: unknown,
): Promise<ActionResult> {
  const parsed = idSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" }
  }
  const orgId = await getCurrentOrgId()
  const ref = getDb().doc(
    `${orgAwarenessProposalsPath(orgId)}/${parsed.data.id}`,
  )
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: "Proposal not found" }
  await ref.update({ status: "rejected", updatedAt: new Date().toISOString() })
  revalidatePath("/awareness")
  return { ok: true, id: parsed.data.id }
}
