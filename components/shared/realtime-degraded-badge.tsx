"use client"

import { WifiOff } from "lucide-react"

import { useRealtimeDegraded } from "@/lib/realtime/degraded-state"

export function RealtimeDegradedBadge() {
  const { degraded } = useRealtimeDegraded()
  if (!degraded) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-200">
      <WifiOff className="size-3" aria-hidden />
      Live sync paused
    </span>
  )
}
