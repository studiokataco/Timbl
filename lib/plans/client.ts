"use client"

import { createContext, useContext } from "react"
import type { PlanFeatures } from "./plans"

/*
 * Client-side accessor for the current org's plan + features. Hydrated
 * once at the (app) layout by `<PlanFeaturesProvider>` from a server
 * fetch - the client NEVER hits Firestore for this.
 *
 * UI affordances only:
 *   - Grey/disable buttons for gated features
 *   - Show "Upgrade" badges
 *   - Render quota meters
 * Enforcement is server-side; this context is purely cosmetic.
 */

const PlanFeaturesContext = createContext<PlanFeatures | null>(null)

export function usePlanFeatures(): PlanFeatures {
  const value = useContext(PlanFeaturesContext)
  if (!value) {
    throw new Error(
      "usePlanFeatures called outside <PlanFeaturesProvider>. Wrap the (app) layout.",
    )
  }
  return value
}

export const PlanFeaturesContextRaw = PlanFeaturesContext
