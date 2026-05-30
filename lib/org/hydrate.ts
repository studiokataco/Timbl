import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgAgentConfigsPath } from "@/lib/firebase/paths"
import {
  AGENT_DEFAULTS,
  getAgentDefault,
  getAgentDefaultBudgets,
} from "@/lib/agents/defaults"

/*
 * The multi-tenant blocking trigger (functions/src/setUserClaims.ts) creates
 * skeletal agentConfig rows with `needsHydration: true` so it can finish
 * inside the 7s timeout. This helper finishes the job from inside the Next
 * app, where AGENT_DEFAULTS is canonically available with full prompts and
 * tool lists.
 *
 * Called from the onboarding page render. Safe to call on every load - the
 * needsHydration:true check makes it a no-op once the org is fully bootstrapped.
 */
export async function hydrateAgentStubs(orgId: string): Promise<void> {
  const db = getAdminDb()
  const col = db.collection(orgAgentConfigsPath(orgId))
  const stubs = await col.where("needsHydration", "==", true).get()
  if (stubs.empty) return

  const now = new Date().toISOString()
  for (const doc of stubs.docs) {
    const def = getAgentDefault(doc.id)
    if (!def) {
      /* Unknown stub name - clear the flag so we don't loop on it. The
       * row stays as-is for the user to delete manually. */
      await doc.ref.set({ needsHydration: false, updatedAt: now }, { merge: true })
      continue
    }
    await doc.ref.set(
      {
        id: def.name,
        organizationId: orgId,
        name: def.name,
        role: def.role,
        description: def.description,
        provider: def.provider,
        model: def.model,
        temperature: def.temperature,
        systemPrompt: def.systemPrompt,
        enabled: def.enabled,
        schedule: def.schedule ?? null,
        allowedTools: def.allowedTools,
        triggers: def.triggers,
        budgets: getAgentDefaultBudgets(def),
        needsHydration: false,
        updatedAt: now,
      },
      { merge: true },
    )
  }
}

/* Convenience: returns whether the org still has any unhydrated stubs.
 * Currently unused but handy for status displays. */
export async function hasUnhydratedStubs(orgId: string): Promise<boolean> {
  const snap = await getAdminDb()
    .collection(orgAgentConfigsPath(orgId))
    .where("needsHydration", "==", true)
    .limit(1)
    .get()
  return !snap.empty
}

/* Subset of AGENT_DEFAULTS for callers that need to enumerate. */
export function listKnownAgentNames(): string[] {
  return AGENT_DEFAULTS.map((d) => d.name)
}
