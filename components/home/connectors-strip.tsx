"use client"

import { useState } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { toast } from "sonner"
import { ChannelGlyph } from "@/components/shared/channel-glyph"
import { GoogleDriveIcon } from "@/components/marketing/brand-icons"
import { Button } from "@/components/ui/button"
import { updateCurrentUserPreferences } from "@/lib/actions/user"
import type { ChannelKey } from "@/lib/schemas"
import { faviconUrl } from "@/lib/url"
import { cn } from "@/lib/utils"
import { useHomeChats } from "./home-chats"

export type ConnectorItem = { key: string; label: string } & (
  | { kind: "channel"; channel: ChannelKey }
  | { kind: "gdrive" }
  | { kind: "favicon"; domain: string }
)

export function ConnectorsStrip({ items, hidden }: { items: ConnectorItem[]; hidden: boolean }) {
  const { copy } = useHomeChats()
  const [dismissed, setDismissed] = useState(hidden)
  if (dismissed || !items.length) return null
  return (
    <div className="mx-auto mt-2 flex w-full max-w-xl items-center gap-1">
      <Link
        href="/settings/integrations"
        className="flex min-h-9 min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-1.5 text-caption text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground focus-ring"
      >
        <span className="min-w-0 text-pretty">{copy.connectors}</span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {items.map((item) =>
            item.kind === "channel" ? (
              <ChannelGlyph key={item.key} channel={item.channel} className={cn("size-4", item.channel === "x" && "dark:invert")} />
            ) : item.kind === "gdrive" ? (
              <span key={item.key} title={item.label} className="inline-flex size-4 shrink-0">
                <GoogleDriveIcon aria-hidden />
              </span>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img key={item.key} src={faviconUrl(`https://${item.domain}`)} alt="" title={item.label} className="size-4 shrink-0 rounded-sm" />
            ),
          )}
        </span>
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={copy.hideConnectors}
        onClick={() => {
          setDismissed(true)
          void updateCurrentUserPreferences({ connectorsStripHidden: true }).then((result) => {
            if (!result.ok) {
              setDismissed(false)
              toast.error(result.error ?? copy.updateFailed)
            }
          })
        }}
      >
        <X className="size-3.5" aria-hidden />
      </Button>
    </div>
  )
}
