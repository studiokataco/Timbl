"use client"

import { useEffect, useState } from "react"

/**
 * SSR-safe media-query hook. Returns `false` on the server and on the first
 * client render, then syncs to the actual match after mount. Use it to gate
 * components whose mere mounting has side effects (e.g. a Sheet whose
 * backdrop portal would otherwise dim the page at all viewport sizes).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const mql = window.matchMedia(query)
    const sync = () => setMatches(mql.matches)
    sync()
    mql.addEventListener("change", sync)
    return () => mql.removeEventListener("change", sync)
  }, [query])

  return matches
}
