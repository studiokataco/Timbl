"use client"

import { createContext, useContext } from "react"

const WorkspaceContext = createContext<{ orgId: string } | null>(null)

export function WorkspaceProvider({
  orgId,
  children,
}: {
  orgId: string
  children: React.ReactNode
}) {
  return (
    <WorkspaceContext.Provider value={{ orgId }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspaceOrgId(): string {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) {
    throw new Error("useWorkspaceOrgId must be used inside WorkspaceProvider")
  }
  return ctx.orgId
}
