"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"

type Politeness = "polite" | "assertive"
type Announce = (message: string, politeness?: Politeness) => void
type Regions = { polite: string; assertive: string }

const HOLD_MS = 500

const AnnounceContext = createContext<Announce | null>(null)
const RegionsContext = createContext<Regions>({ polite: "", assertive: "" })

export function LiveAnnouncerProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [regions, setRegions] = useState<Regions>({ polite: "", assertive: "" })
  const queue = useRef<{ message: string; politeness: Politeness }[]>([])
  const busy = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const frame = useRef<number | null>(null)

  const next = useCallback(function drain() {
    const item = queue.current.shift()
    if (!item) {
      busy.current = false
      return
    }
    busy.current = true
    setRegions((prev) => ({ ...prev, [item.politeness]: "" }))
    frame.current = requestAnimationFrame(() => {
      setRegions((prev) => ({ ...prev, [item.politeness]: item.message }))
      timer.current = setTimeout(drain, HOLD_MS)
    })
  }, [])

  const announce = useCallback<Announce>(
    (message, politeness = "polite") => {
      if (!message) return
      queue.current.push({ message, politeness })
      if (!busy.current) next()
    },
    [next],
  )

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      if (frame.current !== null) cancelAnimationFrame(frame.current)
      queue.current = []
      busy.current = false
    },
    [],
  )

  return (
    <AnnounceContext.Provider value={announce}>
      <RegionsContext.Provider value={regions}>{children}</RegionsContext.Provider>
    </AnnounceContext.Provider>
  )
}

export function LiveRegions(): React.JSX.Element {
  const { polite, assertive } = useContext(RegionsContext)
  return (
    <div data-slot="agentic-announcer">
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {polite}
      </div>
      <div role="alert" className="sr-only">
        {assertive}
      </div>
    </div>
  )
}

export function useAnnounce(): Announce {
  const announce = useContext(AnnounceContext)
  if (!announce) throw new Error("useAnnounce needs LiveAnnouncerProvider")
  return announce
}
