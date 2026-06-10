export const ONBOARDING_STEP_IDS = [
  "profile",
  "agents",
  "categories",
  "templates",
  "channels",
] as const

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number]

export function isOnboardingStepId(value: unknown): value is OnboardingStepId {
  return (
    typeof value === "string" &&
    (ONBOARDING_STEP_IDS as readonly string[]).includes(value)
  )
}
