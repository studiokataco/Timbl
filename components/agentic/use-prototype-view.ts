"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { parseView, serializeView } from "./view-state"
import type { ViewState } from "./types"

export function usePrototypeView(initial: ViewState, syncUrl = true) {
  const [view, setView] = useState(() => {
    if (!syncUrl || typeof window === "undefined") return initial
    return { ...initial, ...parseView(new URLSearchParams(window.location.search)) }
  })
  const ref = useRef(view)
  useEffect(() => {
    if (!syncUrl) return
    const apply = (params: URLSearchParams) => {
      const next = { ...ref.current, ...parseView(params) }
      ref.current = next
      setView(next)
    }
    apply(new URLSearchParams(window.location.search))
    const onPop = () => apply(new URLSearchParams(window.location.search))
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [syncUrl])
  const update = useCallback((patch: Partial<ViewState>, mode: "push" | "replace" = "replace") => {
    const next = { ...ref.current, ...patch }
    ref.current = next
    if (syncUrl) {
      const qs = serializeView(next)
      const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
      if (mode === "push") window.history.pushState({ mockupPushed: true }, "", url)
      else window.history.replaceState({ mockupPushed: Boolean(window.history.state?.mockupPushed) }, "", url)
    }
    setView(next)
  }, [syncUrl])
  const dismiss = useCallback(
    (patch: Partial<ViewState>) => {
      update(patch, "replace")
    },
    [update],
  )
  return { view, update, dismiss }
}
