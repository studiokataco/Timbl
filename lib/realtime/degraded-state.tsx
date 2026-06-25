"use client"

import { createContext, useCallback, useContext, useState } from "react"

const RealtimeDegradedContext = createContext<{
  degraded: boolean
  setDegraded: (v: boolean) => void
} | null>(null)

export function RealtimeDegradedProvider({ children }: { children: React.ReactNode }) {
  const [degraded, setDegradedState] = useState(false)
  const setDegraded = useCallback((v: boolean) => setDegradedState(v), [])
  return (
    <RealtimeDegradedContext.Provider value={{ degraded, setDegraded }}>
      {children}
    </RealtimeDegradedContext.Provider>
  )
}

export function useRealtimeDegraded() {
  const ctx = useContext(RealtimeDegradedContext)
  if (!ctx) return { degraded: false, setDegraded: () => {} }
  return ctx
}
