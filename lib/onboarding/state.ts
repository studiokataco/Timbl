import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgPath } from "@/lib/firebase/paths"

/*
 * Server-only helpers for reading/writing the org's onboarding state.
 * The (app) layout calls `isOnboardingComplete` to decide whether to
 * redirect to /onboarding; the wizard's final step calls
 * `markOnboardingComplete` to flip the flag.
 *
 * Schema lives on the org doc (`onboarding.completedAt`), not in a
 * sub-collection, so the redirect check is a single doc read.
 */

export interface OnboardingProfile {
  industry?: string
  audience?: string
  tone?: string
  channels?: string[]
}

export interface OnboardingState {
  completedAt?: string
  skippedSteps?: string[]
  profile?: OnboardingProfile
  /* Furthest step the wizard reached - validated against the step-id enum
   * on read; cleared on complete and on re-run reset. */
  lastStep?: string | null
}

export async function getOnboardingState(orgId: string): Promise<OnboardingState> {
  const snap = await getAdminDb().doc(orgPath(orgId)).get()
  const data = snap.data() ?? {}
  return (data.onboarding as OnboardingState | undefined) ?? {}
}

export async function isOnboardingComplete(orgId: string): Promise<boolean> {
  const state = await getOnboardingState(orgId)
  return Boolean(state.completedAt)
}
