"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"
import { useReducedMotionConfig } from "framer-motion"
import { makeCopy, type Copy } from "./copy"
import { DEFAULT_PREFS, FALLBACK_VIEWER } from "./defaults"
import { usePrototypeView } from "./use-prototype-view"
import type { AmbientSignal, PresencePrefs, TeamMember, ToolbarAction, UserRole, ViewState } from "./types"

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
  replayKey: number
  bumpReplay: () => void
  toolbarAction: (action: ToolbarAction) => void
  registerToolbarHandler: (fn: ((action: ToolbarAction) => void) | null) => void
  ambient: AmbientSignal
  setAmbient: (patch: Partial<AmbientSignal>) => void
}

const DEFAULT_ASSISTANT_NAME = "Timbl"
const IDLE_AMBIENT: AmbientSignal = { active: false, source: null, outputId: null, outputChars: 0, working: false, level: 0 }

const PrototypeContext = createContext<PrototypeContextValue | null>(null)

export function PrototypeProvider({
  initialView,
  children,
  syncUrl = true,
  viewer: viewerProp,
  team = [],
  workspaceName = "Workspace",
  assistantName: assistantNameProp,
  prefs: prefsProp,
}: {
  initialView: ViewState
  children: React.ReactNode
  syncUrl?: boolean
  viewer?: TeamMember
  team?: TeamMember[]
  workspaceName?: string
  assistantName?: string
  prefs?: PresencePrefs
}): React.JSX.Element {
  const { view, update, dismiss } = usePrototypeView(initialView, syncUrl)
  const [assistantName, setAssistantName] = useState(assistantNameProp ?? DEFAULT_ASSISTANT_NAME)
  const [prefs, setPrefs] = useState<PresencePrefs>(prefsProp ?? DEFAULT_PREFS)
  const [disclosure, setDisclosureState] = useState<Record<string, boolean>>({})
  const [replayKey, setReplayKey] = useState(0)
  const [ambient, setAmbientState] = useState<AmbientSignal>(IDLE_AMBIENT)
  const toolbarHandler = useRef<((action: ToolbarAction) => void) | null>(null)

  const copy = useMemo(() => makeCopy(assistantName, workspaceName), [assistantName, workspaceName])
  const viewer = viewerProp ?? team.find((member) => member.id === FALLBACK_VIEWER.id) ?? team[0] ?? FALLBACK_VIEWER

  const setDisclosure = useCallback((key: string, open: boolean) => {
    setDisclosureState((prev) => (prev[key] === open ? prev : { ...prev, [key]: open }))
  }, [])
  const bumpReplay = useCallback(() => setReplayKey((key) => key + 1), [])
  const toolbarAction = useCallback((action: ToolbarAction) => {
    toolbarHandler.current?.(action)
  }, [])
  const registerToolbarHandler = useCallback((fn: ((action: ToolbarAction) => void) | null) => {
    toolbarHandler.current = fn
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
      replayKey,
      bumpReplay,
      toolbarAction,
      registerToolbarHandler,
      ambient,
      setAmbient,
    }),
    [view, update, dismiss, viewer, team, assistantName, prefs, copy, disclosure, setDisclosure, replayKey, bumpReplay, toolbarAction, registerToolbarHandler, ambient, setAmbient],
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
  const { view, prefs } = usePrototype()
  const { reduced } = useAgenticMotion()
  return {
    glow: view.glow ?? prefs.ambient.glow,
    backgroundMotion: !reduced && (view.mesh ?? prefs.ambient.backgroundMotion),
  }
}
