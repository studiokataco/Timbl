"use client"

import { useEffect } from "react"
import { useEngine } from "./engine/engine-context"
import { useHandoff } from "./handoff/handoff-context"
import { usePrototype } from "./prototype-context"

export function usePrototypeShortcuts(): void {
  const { view, update, dismiss, copy, prefs } = usePrototype()
  const { state, dispatch } = useEngine()
  const { triggerIn } = useHandoff()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || !prefs.shortcuts) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && (e.key === "j" || e.key === "J")) {
        e.preventDefault()
        if (e.shiftKey) {
          if (view.view === "interface") {
            const count = Math.max(1, state.miniChat.length)
            triggerIn({
              carryText: copy.flyout.carryChat(count),
              onSwap: () => {
                dispatch({ type: "handoff_in", carry: "chat" })
                update({ view: "timbl", sheet: null }, "push")
              },
            })
          } else {
            update({ view: "timbl", sheet: null }, "push")
          }
        } else if (view.view === "interface") {
          update({ sheet: view.sheet === "flyout" ? null : "flyout" }, "push")
        }
        return
      }

      if (e.key === "Escape") {
        if (e.defaultPrevented) return
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
  }, [copy.flyout, dismiss, dispatch, prefs.shortcuts, state.canvas.visibility, state.miniChat.length, triggerIn, update, view.canvas, view.sheet, view.view])
}
