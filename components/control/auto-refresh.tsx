"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

/*
 * Live indicator + silent auto-refresh for the ops console. Calls
 * router.refresh() on an interval; because the page is force-dynamic the
 * server component re-runs and streams fresh data in without a full reload.
 * Shows a pulsing dot + seconds-since-update.
 */
export function AutoRefresh({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [secs, setSecs] = useState(0)
  const lastRef = useRef(0)

  useEffect(() => {
    lastRef.current = Date.now()
    const tick = setInterval(() => {
      setSecs(Math.round((Date.now() - lastRef.current) / 1000))
    }, 1000)
    const refresh = setInterval(() => {
      startTransition(() => router.refresh())
      lastRef.current = Date.now()
      setSecs(0)
    }, intervalMs)
    return () => {
      clearInterval(tick)
      clearInterval(refresh)
    }
  }, [router, intervalMs])

  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      Live · updated {secs}s ago
    </span>
  )
}
