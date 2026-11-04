"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react"
import { usePrototype } from "../prototype-context"
import type { EngineEffect, EngineEnv, EngineEvent, EngineState } from "../types"
import { initialEngineState, reduce } from "./reducer"

type EngineContextValue = {
  state: EngineState
  dispatch: (event: EngineEvent) => void
  env: EngineEnv
}

type EngineProviderProps = {
  cadence: number
  campaigns: number
  onEffect?: (effect: EngineEffect, dispatch: (event: EngineEvent) => void) => void
  children: React.ReactNode
}

const EngineContext = createContext<EngineContextValue | null>(null)

export function EngineProvider({ cadence, campaigns, onEffect, children }: EngineProviderProps): React.JSX.Element {
  const { assistantName, role, viewer, team } = usePrototype()
  const env = useMemo<EngineEnv>(
    () => ({ assistantName, role, viewerId: viewer.id, team, cadence, campaigns }),
    [assistantName, cadence, campaigns, role, team, viewer.id],
  )
  const [state, rawDispatch] = useReducer(reduce, undefined, (): EngineState => initialEngineState(env, Date.now()))

  const envRef = useRef(env)
  const onEffectRef = useRef(onEffect)
  const drainedCount = useRef(0)

  useEffect(() => {
    envRef.current = env
    onEffectRef.current = onEffect
  }, [env, onEffect])

  const dispatch = useCallback((event: EngineEvent) => {
    rawDispatch({ ...event, env: envRef.current, now: Date.now() })
  }, [])

  useEffect(() => {
    const effects = state.effects
    if (drainedCount.current > effects.length) drainedCount.current = 0
    const pending = effects.slice(drainedCount.current)
    if (pending.length === 0) return
    drainedCount.current = effects.length
    for (const effect of pending) onEffectRef.current?.(effect, dispatch)
  }, [state.effects, dispatch])

  const value = useMemo<EngineContextValue>(() => ({ state, dispatch, env }), [state, dispatch, env])
  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>
}

export function useEngine(): EngineContextValue {
  const value = useContext(EngineContext)
  if (!value) throw new Error("useEngine needs EngineProvider")
  return value
}
