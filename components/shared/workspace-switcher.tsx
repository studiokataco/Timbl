"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronsUpDown, Loader2, Plus, Settings2 } from "lucide-react"
import { toast } from "sonner"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { activateWorkspaceClient } from "@/lib/auth/activate-workspace-client"
import { setDevOrg } from "@/lib/actions/dev-org"
import type {
  WorkspaceSummary,
  WorkspaceSwitcherData,
} from "@/lib/queries/workspaces.server"
import { IdentityAvatar } from "@/components/shared/identity-avatar"
import { cn } from "@/lib/utils"

const ROLE_ARTICLE: Record<WorkspaceSummary["role"], string> = {
  admin: "an admin",
  editor: "an editor",
  contributor: "a contributor",
}

const TIER_LABELS: Record<WorkspaceSummary["tier"], string> = {
  free: "Free",
  studio: "Studio",
  agency: "Agency",
  scale: "Scale",
}


function workspaceFacts(ws: WorkspaceSummary) {
  return `${TIER_LABELS[ws.tier]} plan · you're ${ROLE_ARTICLE[ws.role]}`
}

export function WorkspaceSwitcher({
  data,
  className,
  nested = false,
}: {
  data: WorkspaceSwitcherData
  className?: string
  nested?: boolean
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
          "group flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-secondary/60",
          nested
            ? "rounded-t-xl focus-visible:ring-inset"
            : "rounded-xl border border-border bg-background",
          className,
        )}
        aria-label={`Current workspace: ${current.name}. Switch workspace`}
      >
        <IdentityAvatar name={current.name} src={current.logoUrl} color={current.color} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold leading-tight text-foreground">
            {current.name}
          </span>
          <span className="truncate text-caption text-muted-foreground">
            Workspace
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
            <DropdownMenuLabel className="text-caption text-muted-foreground">
              Your workspaces
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
                  <IdentityAvatar name={ws.name} src={ws.logoUrl} color={ws.color} className="size-7 text-xs" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium leading-tight">
                      {ws.name}
                    </span>
                    <span className="truncate text-caption text-muted-foreground">{workspaceFacts(ws)}</span>
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
              {workspaceFacts(current)}
            </p>
          </div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings/workspace")} className="gap-2.5 py-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground">
            <Settings2 aria-hidden className="size-4" />
          </span>
          <span className="text-sm font-medium">Workspace settings</span>
        </DropdownMenuItem>

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
