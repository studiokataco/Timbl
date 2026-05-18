"use server"

import { z } from "zod"

import { getAdminDb } from "@/lib/firebase/admin"
import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { orgAgentRunsPath } from "@/lib/firebase/paths"
import {
  agentRunSchema,
  type AgentRunDoc,
} from "@/lib/schemas/agentRun"

const ServerActionResult = z.object({
  ok: z.boolean(),
  id: z.string().optional(),
  error: z.string().optional(),
})
export type ServerActionResult = z.infer<typeof ServerActionResult>

const listInput = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  agentName: z.string().optional(),
  status: z.string().optional(),
})

export async function listAgentRuns(
  input: unknown = {},
): Promise<AgentRunDoc[]> {
  const parsed = listInput.parse(input ?? {})
  const orgId = await getCurrentOrgId()
  let q: FirebaseFirestore.Query = getAdminDb().collection(
    orgAgentRunsPath(orgId),
  )
  if (parsed.agentName) q = q.where("agentName", "==", parsed.agentName)
  if (parsed.status) q = q.where("status", "==", parsed.status)
  q = q.orderBy("startedAt", "desc").limit(parsed.limit)
  const snap = await q.get()
  const out: AgentRunDoc[] = []
  for (const d of snap.docs) {
    const r = agentRunSchema.safeParse({
      ...(d.data() ?? {}),
      id: d.id,
      organizationId: orgId,
    })
    if (r.success) {
      out.push(r.data)
    } else {
      /* Log + skip rather than silently drop. Schema drift here
       * previously hid the Activity panel for hours of debugging. */
      console.warn(
        `[listAgentRuns] dropped run ${d.id}: ${r.error.issues.map((i) => `${i.path.join(".")}=${i.message}`).join("; ")}`,
      )
    }
  }
  return out
}

export async function getAgentRun(
  runId: string,
): Promise<AgentRunDoc | null> {
  const orgId = await getCurrentOrgId()
  const snap = await getAdminDb()
    .collection(orgAgentRunsPath(orgId))
    .doc(runId)
    .get()
  if (!snap.exists) return null
  const r = agentRunSchema.safeParse({
    ...(snap.data() ?? {}),
    id: runId,
    organizationId: orgId,
  })
  return r.success ? r.data : null
}

export async function cancelAgentRun(
  runId: string,
): Promise<ServerActionResult> {
  const orgId = await getCurrentOrgId()
  const ref = getAdminDb().collection(orgAgentRunsPath(orgId)).doc(runId)
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: "not_found" }
  await ref.set(
    {
      status: "cancelled",
      finishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
  return { ok: true, id: runId }
}
