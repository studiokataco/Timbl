"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Building2, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { activateWorkspaceClient } from "@/lib/auth/activate-workspace-client"
import { setDevOrg } from "@/lib/actions/dev-org"
import { cn } from "@/lib/utils"

export function WorkspacePicker({
  workspaces,
  devShim,
  highlightNew,
}: {
  workspaces: {
    organizationId: string
    name: string
    role: string
    userId: string
  }[]
  devShim: boolean
  highlightNew: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  function openWorkspace(fn: () => Promise<void>, id: string) {
    setBusyId(id)
    startTransition(async () => {
      try {
        await fn()
        router.replace("/calendar")
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not open workspace")
      } finally {
        setBusyId(null)
      }
    })
  }

  if (devShim) {
    return <DevWorkspacePicker highlightNew={highlightNew} />
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create a workspace</h1>
        <p className="text-sm text-muted-foreground">
          Get ready to level up your social media management in seconds.
        </p>
      </header>

      {workspaces.length > 0 ? (
        <ul className="space-y-2">
          {workspaces.map((ws) => (
            <li key={ws.organizationId}>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  openWorkspace(async () => {
                    await activateWorkspaceClient({
                      organizationId: ws.organizationId,
                    })
                  }, ws.organizationId)
                }
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border border-border p-4 text-left transition hover:bg-muted/50",
                  busyId === ws.organizationId && "opacity-70",
                )}
              >
                <Building2 className="size-5 shrink-0 text-muted-foreground" />
                <span className="flex-1">
                  <span className="block text-sm font-medium">{ws.name}</span>
                  <span className="block text-xs text-muted-foreground capitalize">
                    {ws.role}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {busyId === ws.organizationId ? "Opening…" : "Open"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div
        className={cn(
          "rounded-lg border p-4 space-y-3",
          highlightNew ? "border-foreground" : "border-border",
        )}
      >
        <div className="flex items-center gap-2">
          <Plus className="size-5" />
          <h2 className="text-sm font-medium">Create a new workspace</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Set up your organization workspace with the wizard.
        </p>
        <Button
          className="w-full"
          disabled={pending}
          onClick={() =>
            openWorkspace(async () => {
              await activateWorkspaceClient({ create: true })
            }, "new")
          }
        >
          {busyId === "new" ? "Creating…" : "Create workspace"}
        </Button>
      </div>
    </div>
  )
}

function DevWorkspacePicker({ highlightNew }: { highlightNew: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)

  function pick(mode: "tenant" | "demo", id: string) {
    setBusy(id)
    startTransition(async () => {
      const result = await setDevOrg({ mode })
      if (!result.ok) {
        toast.error(result.error ?? "Could not open workspace")
        setBusy(null)
        return
      }
      router.replace("/calendar")
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a workspace</h1>
        <p className="text-sm text-muted-foreground">
          Emulator mode - same step as after sign up in production.
        </p>
      </header>

      <div
        className={cn(
          "rounded-lg border p-4 space-y-3",
          highlightNew ? "border-foreground" : "border-border",
        )}
      >
        <h2 className="text-sm font-medium">Create a new workspace</h2>
        <p className="text-xs text-muted-foreground">
          Empty tenant org - onboarding wizard fills it in.
        </p>
        <Button
          className="w-full"
          disabled={pending}
          onClick={() => pick("tenant", "tenant")}
        >
          {busy === "tenant" ? "Opening…" : "Create workspace"}
        </Button>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="text-sm font-medium">Existing demo workspace</h2>
        <p className="text-xs text-muted-foreground">
          Fully seeded SAFE Foundation org for demos.
        </p>
        <Button
          variant="outline"
          className="w-full"
          disabled={pending}
          onClick={() => pick("demo", "demo")}
        >
          {busy === "demo" ? "Opening…" : "Open SAFE demo"}
        </Button>
      </div>
    </div>
  )
}
