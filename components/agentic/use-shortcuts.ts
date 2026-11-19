"use client"

import { useEffect } from "react"
import { useEngine } from "./engine/engine-context"
import { usePrototype } from "./prototype-context"

export function usePrototypeShortcuts(): void {
  const { view, update, dismiss, prefs } = usePrototype()
  const { state, dispatch } = useEngine()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || !prefs.shortcuts) return
      if (e.target instanceof Element && e.target.closest("[data-slot='command']")) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && (e.key === "j" || e.key === "J")) {
        e.preventDefault()
        if (e.shiftKey) {
          window.dispatchEvent(new Event("timbl:mode"))
        } else if (view.view === "interface") {
          update({ sheet: view.sheet === "flyout" ? null : "flyout" }, "push")
        }
        return
      }

      if (e.key === "Escape") {
        if (e.defaultPrevented) return
        if (document.querySelector("[data-slot='command']")) return
        if (view.sheet) {
          e.preventDefault()
          dismiss({ sheet: null })
          return
        }
        if (document.querySelector("[role='dialog']")) return
        if (view.canvas === "expanded" || state.canvas.visibility === "expanded") {
          e.preventDefault()
          dispatch({ type: "canvas_visibility", visibility: "shown" })
          dismiss({ canvas: "shown" })
        }
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [dismiss, dispatch, prefs.shortcuts, state.canvas.visibility, update, view.canvas, view.sheet, view.view])
}
