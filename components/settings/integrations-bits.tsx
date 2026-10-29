"use client"

import { useState, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Link2, Loader2, MoreHorizontal, Plus, RotateCw, Unplug } from "lucide-react"
import { toast } from "sonner"

import { ListRow } from "@/components/shared/list-panel"
import { StatusDot } from "@/components/shared/status-dot"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ServerActionResult } from "@/lib/schemas"
import { cn } from "@/lib/utils"

export const ROW_BUTTON = cn(buttonVariants({ variant: "outline" }), "h-9 px-3 text-[13px]")

export type LinkedAccount = {
  id: string
  displayName: string
  status: "active" | "needs_reauth" | "revoked"
}

type State = "connected" | "reconnect" | "off"

const STATE_COPY: Record<State, { label: string; dot: string; text: string }> = {
  connected: { label: "Connected", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  reconnect: { label: "Needs reconnecting", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  off: { label: "Not connected", dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
}

export function LogoTile({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-background [&>*]:size-[18px]",
        className,
      )}
    >
      {children}
    </span>
  )
}

export function StatusLine({ state, detail }: { state: State; detail?: string }) {
  const copy = STATE_COPY[state]
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 align-middle">
      <StatusDot className={copy.dot} />
      <span className={cn("shrink-0 font-medium", copy.text)}>{copy.label}</span>
      {detail ? <span className="min-w-0 truncate">· {detail}</span> : null}
    </span>
  )
}

export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Couldn't copy. Select the text and copy it by hand.")
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-lg"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      className={cn("shrink-0 bg-background", className)}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
    </Button>
  )
}

export function CopyField({ value, label, display }: { value: string; label: string; display?: string }) {
  return (
    <div className="flex items-start gap-2">
      <code className="min-w-0 flex-1 rounded-lg bg-secondary px-3 py-2 font-mono text-[12px] leading-5 text-foreground wrap-anywhere">
        {display ?? value}
      </code>
      <CopyButton value={value} label={label} />
    </div>
  )
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  pending: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-[13px]">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" className="h-9" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" className="h-9" disabled={pending} onClick={onConfirm}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ConnectionRow({
  name,
  leading,
  accounts,
  connectHref,
  idleHint,
  blockedHint,
  blockedAction,
  menuExtras,
  disconnect,
  disconnectNote,
}: {
  name: string
  leading: ReactNode
  accounts: LinkedAccount[]
  connectHref: string | null
  idleHint?: string
  blockedHint?: string
  blockedAction?: ReactNode
  menuExtras?: ReactNode
  disconnect: (id: string) => Promise<ServerActionResult>
  disconnectNote: string
}) {
  const router = useRouter()
  const [target, setTarget] = useState<LinkedAccount | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const needsReconnect = accounts.some((a) => a.status !== "active")
  const state: State = needsReconnect ? "reconnect" : accounts.length > 0 ? "connected" : "off"
  const names = accounts.map((a) => a.displayName).join(", ")
  const detail = accounts.length > 0 ? names : connectHref ? idleHint : blockedHint
  const hasMenu = accounts.length > 0 || Boolean(menuExtras)

  function confirmDisconnect() {
    if (!target) return
    const account = target
    startTransition(async () => {
      const res = await disconnect(account.id)
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't disconnect")
        return
      }
      toast.success(`${account.displayName} disconnected`)
      setConfirmOpen(false)
      router.refresh()
    })
  }

  const primary =
    state === "reconnect" && connectHref ? (
      <a href={connectHref} className={ROW_BUTTON}>
        <RotateCw aria-hidden />
        Reconnect
      </a>
    ) : state === "off" && connectHref ? (
      <a href={connectHref} className={ROW_BUTTON}>
        <Link2 aria-hidden />
        Connect
      </a>
    ) : state === "off" ? (
      blockedAction
    ) : null

  return (
    <>
      <ListRow
        leading={leading}
        title={name}
        subtitle={<StatusLine state={state} detail={detail} />}
        actions={
          primary || hasMenu ? (
            <>
              {primary}
              {hasMenu ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="icon-lg" aria-label={`More options for ${name}`} />
                    }
                  >
                    <MoreHorizontal aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60 p-1">
                    {accounts.length > 0 && connectHref ? (
                      <DropdownMenuItem
                        className="gap-2 py-1.5 text-[13px]"
                        onClick={() => window.location.assign(connectHref)}
                      >
                        <Plus aria-hidden />
                        Connect another account
                      </DropdownMenuItem>
                    ) : null}
                    {menuExtras}
                    {accounts.length > 0 && (connectHref || menuExtras) ? <DropdownMenuSeparator /> : null}
                    {accounts.map((a) => (
                      <DropdownMenuItem
                        key={a.id}
                        variant="destructive"
                        className="gap-2 py-1.5 text-[13px]"
                        onClick={() => {
                          setTarget(a)
                          setConfirmOpen(true)
                        }}
                      >
                        <Unplug aria-hidden />
                        <span className="min-w-0 truncate">
                          {accounts.length > 1 ? `Disconnect ${a.displayName}` : "Disconnect"}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </>
          ) : undefined
        }
      />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => !open && !pending && setConfirmOpen(false)}
        title={`Disconnect ${target?.displayName ?? name}?`}
        description={disconnectNote}
        confirmLabel="Disconnect"
        pending={pending}
        onConfirm={confirmDisconnect}
      />
    </>
  )
}
