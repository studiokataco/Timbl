"use client"

import { createContext, useContext } from "react"
import type { PresencePrefs, TeamMember } from "@/components/agentic/types"

export type AssistantSetup = {
  team: TeamMember[]
  viewerId: string
  workspaceName: string
  assistantName: string
  prefs: PresencePrefs
  brandId: string
  campaignCount: number
  cadencePerWeek: number
}

const AssistantSetupContext = createContext<AssistantSetup | null>(null)

export function AssistantSetupProvider({ value, children }: { value: AssistantSetup; children: React.ReactNode }) {
  return <AssistantSetupContext.Provider value={value}>{children}</AssistantSetupContext.Provider>
}

export function useAssistantSetup(): AssistantSetup {
  const value = useContext(AssistantSetupContext)
  if (!value) throw new Error("useAssistantSetup needs AssistantSetupProvider")
  return value
}
