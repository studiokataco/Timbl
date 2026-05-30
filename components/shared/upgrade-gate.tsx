"use client"

import type { ReactNode } from "react"
import { usePlanFeatures } from "@/lib/plans/client"
import type { PlanFeatureFlag } from "@/lib/plans/plans"

/*
 * Inline upsell wrapper. Renders children when the current plan unlocks
 * `feature`; otherwise renders `fallback` (or nothing). The server still
 * enforces - this just hides surface area so users don't click into a
 * dead-end action.
 *
 *   <UpgradeGate feature="customCategories" fallback={<UpgradeBadge/>}>
 *     <NewCategoryButton/>
 *   </UpgradeGate>
 */
export function UpgradeGate({
  feature,
  children,
  fallback = null,
}: {
  feature: PlanFeatureFlag
  children: ReactNode
  fallback?: ReactNode
}) {
  const plan = usePlanFeatures()
  if (plan.features[feature]) return <>{children}</>
  return <>{fallback}</>
}

/* Inverse: render only when feature is LOCKED. Useful for showing
 * "Upgrade to Agency" badges next to a disabled control. */
export function UpgradePromptFor({
  feature,
  children,
}: {
  feature: PlanFeatureFlag
  children: ReactNode
}) {
  const plan = usePlanFeatures()
  if (plan.features[feature]) return null
  return <>{children}</>
}
