"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { useReducedMotionConfig } from "framer-motion"
import { makeCopy, type Copy } from "./copy"
import { usePrototypeView } from "./use-prototype-view"
import type { AmbientSignal, PresencePrefs, TeamMember, UserRole, ViewState } from "./types"

type PrototypeContextValue = {
  view: ViewState
  update: (patch: Partial<ViewState>, mode?: "push" | "replace") => void
  dismiss: (patch: Partial<ViewState>) => void
  role: UserRole
  viewer: TeamMember
  team: TeamMember[]
  assistantName: string
  setAssistantName: (name: string) => void
  prefs: PresencePrefs
  setPrefs: (prefs: PresencePrefs) => void
  copy: Copy
  disclosure: Record<string, boolean>
  setDisclosure: (key: string, open: boolean) => void
  ambient: AmbientSignal
  setAmbient: (patch: Partial<AmbientSignal>) => void
}

const IDLE_AMBIENT: AmbientSignal = { active: false, source: null, outputId: null, outputChars: 0, working: false, level: 0 }

const PrototypeContext = createContext<PrototypeContextValue | null>(null)

export function PrototypeProvider({
  initialView,
  children,
  viewer,
  team,
  workspaceName,
  assistantName: assistantNameProp,
  prefs: prefsProp,
}: {
  initialView: ViewState
  children: React.ReactNode
  viewer: TeamMember
  team: TeamMember[]
  workspaceName: string
  assistantName: string
  prefs: PresencePrefs
}): React.JSX.Element {
  const { view, update, dismiss } = usePrototypeView(initialView)
  const [assistantName, setAssistantName] = useState(assistantNameProp)
  const [prefs, setPrefs] = useState<PresencePrefs>(prefsProp)
  const [disclosure, setDisclosureState] = useState<Record<string, boolean>>({})
  const [ambient, setAmbientState] = useState<AmbientSignal>(IDLE_AMBIENT)

  const copy = useMemo(() => makeCopy(assistantName, workspaceName), [assistantName, workspaceName])

  const setDisclosure = useCallback((key: string, open: boolean) => {
    setDisclosureState((prev) => (prev[key] === open ? prev : { ...prev, [key]: open }))
  }, [])
  const setAmbient = useCallback((patch: Partial<AmbientSignal>) => {
    setAmbientState((prev) => {
      const next = { ...prev, ...patch }
      const changed = (Object.keys(next) as (keyof AmbientSignal)[]).some((key) => next[key] !== prev[key])
      return changed ? next : prev
    })
  }, [])

  const value = useMemo<PrototypeContextValue>(
    () => ({
      view,
      update,
      dismiss,
      role: viewer.role,
      viewer,
      team,
      assistantName,
      setAssistantName,
      prefs,
      setPrefs,
      copy,
      disclosure,
      setDisclosure,
      ambient,
      setAmbient,
    }),
    [view, update, dismiss, viewer, team, assistantName, prefs, copy, disclosure, setDisclosure, ambient, setAmbient],
  )

  return <PrototypeContext.Provider value={value}>{children}</PrototypeContext.Provider>
}

export function usePrototype(): PrototypeContextValue {
  const value = useContext(PrototypeContext)
  if (!value) throw new Error("usePrototype needs PrototypeProvider")
  return value
}

export function useAgenticMotion(): { reduced: boolean } {
  return { reduced: useReducedMotionConfig() ?? false }
}

export function useAmbientEnabled(): { glow: boolean; backgroundMotion: boolean } {
  const { prefs } = usePrototype()
  const { reduced } = useAgenticMotion()
  return { glow: prefs.ambient.glow, backgroundMotion: !reduced && prefs.ambient.backgroundMotion }
}
