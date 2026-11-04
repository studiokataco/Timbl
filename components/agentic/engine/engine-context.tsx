"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react"
import { usePrototype } from "../prototype-context"
import type { CanvasVisibility, EngineEffect, EngineEnv, EngineEvent, EngineState, UsageChoice } from "../types"
import { initialEngineState, reduce } from "./reducer"

type EngineContextValue = {
  state: EngineState
  dispatch: (event: EngineEvent) => void
  env: EngineEnv
}

type EngineProviderProps = {
  usage?: UsageChoice
  canvas?: CanvasVisibility
  onEffect?: (effect: EngineEffect) => void
  children: React.ReactNode
}

const EngineContext = createContext<EngineContextValue | null>(null)

export function EngineProvider({ usage, canvas, onEffect, children }: EngineProviderProps): React.JSX.Element {
  const { view, assistantName, role, viewer } = usePrototype()
  const env = useMemo<EngineEnv>(() => ({ assistantName, role, viewerId: viewer.id, speed: view.speed }), [assistantName, role, viewer.id, view.speed])
  const [state, rawDispatch] = useReducer(reduce, undefined, (): EngineState => {
    const initial = initialEngineState(env)
    return {
      ...initial,
      usage: { ...initial.usage, used: (usage ?? view.usage) === "cap" ? initial.usage.limit : (usage ?? view.usage) === "near" ? Math.ceil(initial.usage.limit * 0.9) : 0 },
      canvas: { ...initial.canvas, visibility: canvas ?? view.canvas },
    }
  })

  const envRef = useRef(env)
  const onEffectRef = useRef(onEffect)
  const drained = useRef<EngineEffect[] | null>(null)
  const timers = useRef(new Set<number>())

  useEffect(() => {
    envRef.current = env
    onEffectRef.current = onEffect
  }, [env, onEffect])

  const dispatch = useCallback((event: EngineEvent) => {
    rawDispatch({ ...event, env: envRef.current })
  }, [])

  useEffect(() => {
    const effects = state.effects
    if (drained.current === effects) return
    drained.current = effects
    for (const effect of effects) {
      if (!effect?.type) continue
      if (effect.type !== "tick") {
        onEffectRef.current?.(effect)
        continue
      }
      const event = effect.event ?? { type: "run_tick" }
      if (effect.delayMs <= 0) {
        dispatch(event)
        continue
      }
      const timer = window.setTimeout(() => {
        timers.current.delete(timer)
        dispatch(event)
      }, effect.delayMs)
      timers.current.add(timer)
    }
  }, [state.effects, dispatch])

  useEffect(() => {
    const pending = timers.current
    return () => {
      if (pending.size === 0) return
      pending.forEach((timer) => window.clearTimeout(timer))
      pending.clear()
      drained.current = null
    }
  }, [])

  const value = useMemo<EngineContextValue>(() => ({ state, dispatch, env }), [state, dispatch, env])
  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>
}

export function useEngine(): EngineContextValue {
  const value = useContext(EngineContext)
  if (!value) throw new Error("useEngine needs EngineProvider")
  return value
}
