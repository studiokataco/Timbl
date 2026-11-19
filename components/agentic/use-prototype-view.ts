"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { parseView, serializeView } from "./view-state"
import type { ViewState } from "./types"

export function usePrototypeView(initial: ViewState) {
  const [view, setView] = useState(initial)
  const ref = useRef(view)
  useEffect(() => {
    const apply = () => {
      const next = { ...ref.current, ...parseView(new URLSearchParams(window.location.search)) }
      ref.current = next
      setView(next)
    }
    apply()
    window.addEventListener("popstate", apply)
    return () => window.removeEventListener("popstate", apply)
  }, [])
  const update = useCallback((patch: Partial<ViewState>, mode: "push" | "replace" = "replace") => {
    const next = { ...ref.current, ...patch }
    ref.current = next
    const qs = serializeView(next)
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    if (mode === "push") window.history.pushState(null, "", url)
    else window.history.replaceState(null, "", url)
    setView(next)
  }, [])
  const dismiss = useCallback((patch: Partial<ViewState>) => update(patch, "replace"), [update])
  return { view, update, dismiss }
}
