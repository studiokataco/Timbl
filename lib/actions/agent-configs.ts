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
import {
  AGENT_DEFAULTS,
  getAgentDefault,
  getAgentDefaultBudgets,
  listAgentDefaultNames,
  type AgentDefault,
} from "@/lib/agents/defaults"
import type { ServerActionResult } from "@/lib/schemas"

const UNDELETABLE_AGENTS = new Set(["hello", "pipeline"])

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

/* ---------------- Templates & creation ---------------- */

const createInput = z.object({
  name: z.string().min(1),
  overrides: z
    .object({
      description: z.string().max(2_000).optional(),
      systemPrompt: z.string().max(20_000).optional(),
      model: z.string().min(1).optional(),
      temperature: z.number().min(0).max(2).optional(),
      enabled: z.boolean().optional(),
    })
    .optional(),
})

function docFromDefault(
  d: AgentDefault,
  orgId: string,
  overrides?: z.infer<typeof createInput>["overrides"],
) {
  const now = new Date().toISOString()
  return {
    id: d.name,
    organizationId: orgId,
    name: d.name,
    role: d.role,
    description: overrides?.description ?? d.description,
    provider: d.provider,
    model: overrides?.model ?? d.model,
    temperature: overrides?.temperature ?? d.temperature,
    systemPrompt: overrides?.systemPrompt ?? d.systemPrompt,
    enabled: overrides?.enabled ?? d.enabled,
    schedule: d.schedule ?? null,
    allowedTools: d.allowedTools,
    triggers: d.triggers,
    budgets: getAgentDefaultBudgets(d),
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Installs a single template-derived agentConfig. Refuses if `name` is not a
 * registered factory in lib/agents/defaults.ts or if a doc with that name
 * already exists in the org's collection (use updateAgentConfig to edit it).
 */
export async function createAgentConfig(
  input: unknown,
): Promise<ServerActionResult> {
  const parsed = createInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const def = getAgentDefault(parsed.data.name)
  if (!def) {
    return {
      ok: false,
      error: `Unknown agent template: ${parsed.data.name}. Allowed: ${listAgentDefaultNames().join(", ")}`,
    }
  }
  const orgId = await getCurrentOrgId()
  const ref = getAdminDb()
    .collection(orgAgentConfigsPath(orgId))
    .doc(def.name)
  const existing = await ref.get()
  if (existing.exists) {
    return { ok: false, error: "already_exists" }
  }
  await ref.set(docFromDefault(def, orgId, parsed.data.overrides))
  return { ok: true, id: def.name }
}

/**
 * Bulk-installs every default template missing from the current org.
 * Idempotent: docs that already exist are left untouched.
 */
export async function installDefaultAgents(): Promise<
  ServerActionResult & { installed?: string[]; skipped?: string[] }
> {
  const orgId = await getCurrentOrgId()
  const col = getAdminDb().collection(orgAgentConfigsPath(orgId))
  const installed: string[] = []
  const skipped: string[] = []
  for (const def of AGENT_DEFAULTS) {
    const ref = col.doc(def.name)
    const snap = await ref.get()
    if (snap.exists) {
      skipped.push(def.name)
      continue
    }
    await ref.set(docFromDefault(def, orgId))
    installed.push(def.name)
  }
  return { ok: true, installed, skipped }
}

/**
 * Returns the full template (including systemPrompt) for the Customize panel.
 * Server-only so we don't ship every prompt to the client bundle.
 */
export async function getAgentTemplate(
  name: string,
): Promise<AgentDefault | null> {
  return getAgentDefault(name) ?? null
}

const deleteInput = z.object({ name: z.string().min(1) })

export async function deleteAgentConfig(
  input: unknown,
): Promise<ServerActionResult> {
  const parsed = deleteInput.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  if (UNDELETABLE_AGENTS.has(parsed.data.name)) {
    return { ok: false, error: "protected_agent" }
  }
  const orgId = await getCurrentOrgId()
  const ref = getAdminDb()
    .collection(orgAgentConfigsPath(orgId))
    .doc(parsed.data.name)
  await ref.delete()
  return { ok: true, id: parsed.data.name }
}
