export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"

import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { getOnboardingState } from "@/lib/onboarding/state"
import { listIndustries } from "@/lib/onboarding/industry-defaults"
import { hydrateAgentStubs } from "@/lib/org/hydrate"
import { OnboardingWizard } from "@/components/onboarding/wizard"

/*
 * Wizard entry. If the org is already onboarded the user can still land
 * here (re-run flow), but we don't auto-bounce them to /(app) — that
 * would clash with the "Re-run setup" affordance from settings.
 *
 * The wizard state is hydrated from existing onboarding.profile so a
 * re-run feels like editing, not starting from scratch.
 */
export default async function OnboardingPage() {
  const orgId = await getCurrentOrgId()
  if (!orgId) redirect("/")
  /* If the blocking trigger created stub agentConfigs (needsHydration:true),
   * fill them in with full prompts/budgets/tools BEFORE the wizard renders.
   * Cheap when nothing needs hydrating; one-shot when the org is new. */
  await hydrateAgentStubs(orgId)
  const state = await getOnboardingState(orgId)
  const industries = listIndustries()
  return (
    <OnboardingWizard
      initialProfile={state.profile ?? {}}
      industries={industries}
    />
  )
}
