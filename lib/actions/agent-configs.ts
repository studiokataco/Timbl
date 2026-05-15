"use server"

import { z } from "zod"

import { getAdminDb } from "@/lib/firebase/admin"
import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { orgAgentConfigsPath } from "@/lib/firebase/paths"
import {
  agentConfigSchema,
  agentConfigPatchSchema,
  type AgentConfig,
} from "@/lib/schemas/agentConfig"

const ServerActionResult = z.object({
  ok: z.boolean(),
  id: z.string().optional(),
  error: z.string().optional(),
})
export type ServerActionResult = z.infer<typeof ServerActionResult>

export async function listAgentConfigs(): Promise<AgentConfig[]> {
  const orgId = await getCurrentOrgId()
  const snap = await getAdminDb()
    .collection(orgAgentConfigsPath(orgId))
    .orderBy("name", "asc")
    .get()
  const out: AgentConfig[] = []
  for (const d of snap.docs) {
    const parsed = agentConfigSchema.safeParse({
      ...(d.data() ?? {}),
      id: d.id,
      organizationId: orgId,
    })
    if (parsed.success) out.push(parsed.data)
  }
  return out
}

export async function getAgentConfig(name: string): Promise<AgentConfig | null> {
  const orgId = await getCurrentOrgId()
  const snap = await getAdminDb()
    .collection(orgAgentConfigsPath(orgId))
    .doc(name)
    .get()
  if (!snap.exists) return null
  const parsed = agentConfigSchema.safeParse({
    ...(snap.data() ?? {}),
    id: name,
    organizationId: orgId,
  })
  return parsed.success ? parsed.data : null
}

const updatePatchInput = z.object({
  name: z.string().min(1),
  patch: agentConfigPatchSchema,
})

export async function updateAgentConfig(
  input: unknown,
): Promise<ServerActionResult> {
  const parsed = updatePatchInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid patch" }
  }
  const orgId = await getCurrentOrgId()
  const ref = getAdminDb()
    .collection(orgAgentConfigsPath(orgId))
    .doc(parsed.data.name)
  const snap = await ref.get()
  if (!snap.exists) return { ok: false, error: "not_found" }
  await ref.set(
    { ...parsed.data.patch, updatedAt: new Date().toISOString() },
    { merge: true },
  )
  return { ok: true, id: parsed.data.name }
}

const toggleInput = z.object({
  name: z.string().min(1),
  enabled: z.boolean(),
})

export async function toggleAgent(input: unknown): Promise<ServerActionResult> {
  const parsed = toggleInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const orgId = await getCurrentOrgId()
  const ref = getAdminDb()
    .collection(orgAgentConfigsPath(orgId))
    .doc(parsed.data.name)
  await ref.set(
    { enabled: parsed.data.enabled, updatedAt: new Date().toISOString() },
    { merge: true },
  )
  return { ok: true, id: parsed.data.name }
}
