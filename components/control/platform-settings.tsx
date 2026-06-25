"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  setRealtimeDefault,
  type PlatformConfig,
} from "@/lib/actions/platform/config"

type Result = { ok: boolean; error?: string }

export function PlatformSettings({ initial }: { initial: PlatformConfig }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [enabled, setEnabled] = useState(initial.realtimeDefault)

  const run = (label: string, fn: () => Promise<Result>) =>
    start(async () => {
      const res = await fn()
      if (res.ok) {
        toast.success(`${label} done`)
        router.refresh()
      } else {
        toast.error(`${label} failed: ${res.error ?? "unknown"}`)
      }
    })

  return (
    <section className="rounded-xl bg-card ring-1 ring-foreground/10">
      <header className="flex items-center justify-between gap-3 border-b border-foreground/5 px-4 py-3">
        <div>
          <h2 className="font-heading text-sm font-semibold tracking-tight">
            Global realtime default
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Applies to orgs without an explicit realtime_v1 override. Per-org
            toggles on tenant pages still win.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">owner only</span>
      </header>
      <div className="flex items-center justify-between gap-3 px-4 py-4">
        <span className="text-sm">
          Default for new orgs: {enabled ? "ON" : "OFF"}
        </span>
        <Button
          size="sm"
          variant={enabled ? "destructive" : "default"}
          disabled={pending}
          onClick={() => {
            const next = !enabled
            run("Realtime default", async () => {
              const res = await setRealtimeDefault({ enabled: next })
              if (res.ok) setEnabled(next)
              return res
            })
          }}
        >
          {enabled ? "Turn OFF" : "Turn ON"}
        </Button>
      </div>
    </section>
  )
}
