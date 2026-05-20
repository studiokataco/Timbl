"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Boxes, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { setDevOrg } from "@/lib/actions/dev-org"
import type { DevOrgMode } from "@/lib/auth/dev-session"
import { cn } from "@/lib/utils"

/*
 * Dev workspace chooser. Each card calls setDevOrg to pin the safe_dev_org
 * cookie, then routes to /calendar — the (app) layout redirects the tenant
 * org on to /onboarding when it isn't onboarded yet, so the chooser itself
 * needs no per-mode routing.
 */
export function WorkspaceChooser({
  currentMode,
}: {
  currentMode: DevOrgMode | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [chosen, setChosen] = useState<DevOrgMode | null>(null)

  function choose(mode: DevOrgMode) {
    setChosen(mode)
    startTransition(async () => {
      const result = await setDevOrg({ mode })
      if (!result.ok) {
        toast.error(result.error ?? "Could not open that workspace")
        setChosen(null)
        return
      }
      router.replace("/calendar")
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Choose a workspace
        </h1>
        <p className="text-sm text-muted-foreground">
          Emulator dev mode — pick how you want to open the app. You can switch
          any time from Settings → Workspace.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <ChooserCard
          icon={<Boxes className="size-5" />}
          title="Developer mode"
          description="The SAFE Foundation demo workspace — fully seeded with agents, categories, and awareness days."
          cta="Open demo workspace"
          isCurrent={currentMode === "demo"}
          busy={pending && chosen === "demo"}
          disabled={pending}
          onSelect={() => choose("demo")}
        />
        <ChooserCard
          icon={<Sparkles className="size-5" />}
          title="Set up my workspace"
          description="Start fresh in your own workspace and run the setup wizard for your business."
          cta="Run the wizard"
          isCurrent={currentMode === "tenant"}
          busy={pending && chosen === "tenant"}
          disabled={pending}
          onSelect={() => choose("tenant")}
        />
      </div>
    </div>
  )
}

function ChooserCard({
  icon,
  title,
  description,
  cta,
  isCurrent,
  busy,
  disabled,
  onSelect,
}: {
  icon: React.ReactNode
  title: string
  description: string
  cta: string
  isCurrent: boolean
  busy: boolean
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 transition",
        isCurrent ? "border-foreground" : "border-border",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-md bg-muted text-foreground">
          {icon}
        </span>
        <h2 className="flex-1 text-sm font-medium">{title}</h2>
        {isCurrent ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            Current
          </span>
        ) : null}
      </div>
      <p className="flex-1 text-xs text-muted-foreground">{description}</p>
      <Button size="sm" onClick={onSelect} disabled={disabled}>
        {busy ? "Opening…" : cta}
      </Button>
    </div>
  )
}
