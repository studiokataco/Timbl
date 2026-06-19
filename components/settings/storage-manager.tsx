"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Link2, Unplug } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { disconnectStorageAccount } from "@/lib/actions/storage-accounts"
import { STORAGE_PROVIDERS } from "@/lib/storage/providers"
import { faviconUrl } from "@/lib/url"
import { cn } from "@/lib/utils"
import type { WithId } from "@/lib/firebase/serialize"
import type { StorageProvider } from "@/lib/schemas/_shared"
import type { StorageAccountPublic } from "@/lib/schemas"

type Account = WithId<StorageAccountPublic>

type Props = {
  accounts: Account[]
  availableProviders: StorageProvider[]
}

export function StorageManager({ accounts, availableProviders }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const available = new Set(availableProviders)

  function onDisconnect(id: string) {
    setBusyId(id)
    startTransition(async () => {
      const res = await disconnectStorageAccount(id)
      if (res.ok) toast.success("Storage disconnected")
      else toast.error(res.error ?? "Could not disconnect")
      setBusyId(null)
      router.refresh()
    })
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {STORAGE_PROVIDERS.map((p) => {
        const linked = accounts.filter((a) => a.provider === p.key)
        const isAvailable = available.has(p.key)
        return (
          <div key={p.key} className="rounded-xl border border-border bg-canvas p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={faviconUrl(`https://${p.domain}`)}
                  alt=""
                  className="size-4 rounded-sm"
                />
                {p.label}
              </h2>
              {isAvailable ? (
                <a
                  href={`/api/storage/${p.key}/connect`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  <Link2 aria-hidden />
                  {linked.length > 0 ? "Connect another" : "Connect"}
                </a>
              ) : null}
            </div>

            {!isAvailable && (
              <p className="mt-3 text-xs text-muted-foreground">Not available yet.</p>
            )}

            {isAvailable && linked.length === 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Not connected. Connect your {p.label} account to attach its files to posts.
              </p>
            )}

            {linked.length > 0 && (
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
                          href={`/api/storage/${p.key}/connect`}
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
