"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChannelGlyph } from "@/components/shared/channel-glyph"
import { activateWorkspaceClient } from "@/lib/auth/activate-workspace-client"
import { setDevOrg } from "@/lib/actions/dev-org"
import type {
  WorkspaceSummary,
  WorkspaceSwitcherData,
} from "@/lib/queries/workspaces.server"
import { cn } from "@/lib/utils"

const TIER_LABELS: Record<WorkspaceSummary["tier"], string> = {
  free: "Free",
  studio: "Studio",
  agency: "Agency",
  scale: "Scale",
}

/* Pastel avatar fills from the DESIGN.md badge set - deterministic per name
 * so a workspace keeps the same colour across sessions. */
const AVATAR_FILLS = [
  { bg: "#ede9fe", fg: "#7c3aed" },
  { bg: "#dcfce7", fg: "#16a34a" },
  { bg: "#ffedd5", fg: "#ea580c" },
  { bg: "#fce7f3", fg: "#db2777" },
] as const

function fillFor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return AVATAR_FILLS[Math.abs(hash) % AVATAR_FILLS.length]
}

function WorkspaceAvatar({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const fill = fillFor(name)
  const initial = name.trim().charAt(0).toUpperCase() || "?"
  return (
    <span
      aria-hidden
      style={{ backgroundColor: fill.bg, color: fill.fg }}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold",
        className,
      )}
    >
      {initial}
    </span>
  )
}

function ChannelRow({ channels }: { channels: WorkspaceSummary["channels"] }) {
  if (channels.length === 0) {
    return (
      <span className="text-caption text-muted-foreground">No channels yet</span>
    )
  }
  return (
    <span className="flex items-center gap-1">
      {channels.slice(0, 5).map((ch) => (
        <ChannelGlyph key={ch} channel={ch} className="size-3.5" />
      ))}
    </span>
  )
}

export function WorkspaceSwitcher({
  data,
  className,
}: {
  data: WorkspaceSwitcherData
  className?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const { current, workspaces, canCreateWorkspace, isDevShim } = data
  const hasMultiple = workspaces.length > 1

  function switchTo(ws: WorkspaceSummary) {
    if (ws.current) return
    setBusyId(ws.id)
    startTransition(async () => {
      try {
        if (isDevShim) {
          if (!ws.devMode) throw new Error("Unknown workspace")
          const res = await setDevOrg({ mode: ws.devMode })
          if (!res.ok) throw new Error(res.error ?? "Could not open workspace")
          router.replace("/calendar")
        } else {
          const { next } = await activateWorkspaceClient({ organizationId: ws.id })
          router.replace(next)
        }
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not open workspace")
      } finally {
        setBusyId(null)
      }
    })
  }

  function createWorkspace() {
    router.push("/workspaces?new=1")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-xl border border-border bg-background px-2.5 py-2 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-secondary/60",
          className,
        )}
        aria-label={`Current workspace: ${current.name}. Switch workspace`}
      >
        <WorkspaceAvatar name={current.name} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold leading-tight text-foreground">
            {current.name}
          </span>
          <span className="truncate text-caption capitalize text-muted-foreground">
            {current.role} · {TIER_LABELS[current.tier]}
          </span>
        </span>
        <ChevronsUpDown
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="min-w-64 max-w-80"
      >
        {hasMultiple ? (
          <>
            <DropdownMenuLabel className="text-caption uppercase tracking-wider text-muted-foreground">
              Workspaces
            </DropdownMenuLabel>
            <div className="max-h-72 overflow-y-auto">
              {workspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  disabled={pending}
                  closeOnClick={false}
                  onClick={() => switchTo(ws)}
                  className={cn(
                    "gap-2.5 py-2",
                    ws.current && "bg-secondary/50",
                  )}
                >
                  <WorkspaceAvatar name={ws.name} className="size-7 text-xs" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium leading-tight">
                      {ws.name}
                    </span>
                    <ChannelRow channels={ws.channels} />
                  </span>
                  {busyId === ws.id ? (
                    <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-muted-foreground" />
                  ) : ws.current ? (
                    <Check aria-hidden className="size-4 shrink-0 text-foreground" />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </div>
          </>
        ) : (
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{current.name}</p>
            <p className="text-caption text-muted-foreground">
              You belong to one workspace.
            </p>
          </div>
        )}

        {canCreateWorkspace ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={createWorkspace} className="gap-2.5 py-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                <Plus aria-hidden className="size-4" />
              </span>
              <span className="text-sm font-medium">
                {hasMultiple ? "Add workspace" : "Create or join a workspace"}
              </span>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
