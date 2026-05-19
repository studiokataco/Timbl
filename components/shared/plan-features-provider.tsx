"use client"

import type { ReactNode } from "react"
import { PlanFeaturesContextRaw } from "@/lib/plans/client"
import type { PlanFeatures } from "@/lib/plans/plans"

/* Thin client wrapper that puts the server-fetched PlanFeatures into
 * React context. Mounted once by the (app) layout. */
export function PlanFeaturesProvider({
  value,
  children,
}: {
  value: PlanFeatures
  children: ReactNode
}) {
  return (
    <PlanFeaturesContextRaw.Provider value={value}>
      {children}
    </PlanFeaturesContextRaw.Provider>
  )
}
