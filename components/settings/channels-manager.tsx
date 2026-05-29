"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Link2, Unplug } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { disconnectAccount } from "@/lib/actions/social-accounts"
import { cn } from "@/lib/utils"
import type { WithId } from "@/lib/firebase/serialize"
import type { SocialAccountPublic } from "@/lib/schemas"

const CHANNELS: { key: string; label: string }[] = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "x", label: "X" },
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
]

type Account = WithId<SocialAccountPublic>

export function ChannelsManager({ accounts }: { accounts: Account[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  function onDisconnect(id: string) {
    setBusyId(id)
    startTransition(async () => {
      const res = await disconnectAccount(id)
      if (res.ok) toast.success("Channel disconnected")
      else toast.error(res.error ?? "Could not disconnect")
      setBusyId(null)
      router.refresh()
    })
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {CHANNELS.map((ch) => {
        const linked = accounts.filter((a) => a.channel === ch.key)
        return (
          <div key={ch.key} className="rounded-xl border border-border bg-canvas p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium">{ch.label}</h2>
              <a
                href={`/api/social/${ch.key}/connect`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <Link2 aria-hidden />
                {linked.length > 0 ? "Connect another" : "Connect"}
              </a>
            </div>

            {linked.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">Not connected.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {linked.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{a.displayName}</p>
                      {a.status === "needs_reauth" ? (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-amber-600">
                          <AlertTriangle aria-hidden className="size-3" />
                          Reconnect needed
                        </span>
                      ) : (
                        <Badge variant="secondary" className="mt-0.5 text-[10px]">
                          Active
                        </Badge>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {a.status === "needs_reauth" && (
                        <a
                          href={`/api/social/${ch.key}/connect`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        >
                          Re-auth
                        </a>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending && busyId === a.id}
                        onClick={() => onDisconnect(a.id)}
                      >
                        <Unplug aria-hidden />
                        Disconnect
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
