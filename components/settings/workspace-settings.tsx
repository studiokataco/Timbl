"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { RotateCcw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { resetOnboarding } from "@/lib/actions/onboarding"
import { setDevOrg } from "@/lib/actions/dev-org"
import type { DevOrgMode } from "@/lib/auth/dev-session"

export function WorkspaceSettings({
  completedAt,
  industry,
  devShim,
  devOrgMode,
}: {
  completedAt?: string
  industry?: string
  /* True in emulator dev mode - gates the SAFE-demo-mode switch, which is
   * meaningless once real auth (Phase 7) provides the org. */
  devShim: boolean
  devOrgMode: DevOrgMode
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [switching, startSwitching] = useTransition()

  function handleRerun() {
    startTransition(async () => {
      const result = await resetOnboarding()
      if (!result.ok) {
        toast.error(result.error ?? "Could not start re-run")
        return
      }
      router.push("/onboarding")
      router.refresh()
    })
  }

  function handleDemoToggle(checked: boolean) {
    const mode: DevOrgMode = checked ? "demo" : "tenant"
    startSwitching(async () => {
      const result = await setDevOrg({ mode })
      if (!result.ok) {
        toast.error(result.error ?? "Could not switch workspace")
        return
      }
      toast.success(
        checked
          ? "Switched to the SAFE demo workspace"
          : "Switched to your workspace",
      )
      /* Re-resolves the (app) layout against the new org. If the tenant
       * org hasn't completed onboarding yet, the layout redirects to the
       * wizard. */
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {devShim ? (
        <section className="rounded-lg border border-border p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="safe-demo-mode"
              checked={devOrgMode === "demo"}
              disabled={switching}
              onCheckedChange={(v) => handleDemoToggle(v === true)}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label htmlFor="safe-demo-mode" className="text-sm font-medium">
                SAFE demo mode
              </Label>
              <p className="text-xs text-muted-foreground">
                On - load the fully-seeded SAFE Foundation workspace (its
                agents, categories, and awareness days) for demos. Off - work
                in your own wizard-built workspace. Emulator dev only.
              </p>
              <Link
                href="/welcome"
                className="inline-block text-xs font-medium text-foreground underline underline-offset-2"
              >
                Open the workspace chooser
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium">Setup wizard</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {completedAt
            ? `Completed ${new Date(completedAt).toLocaleDateString()}${
                industry ? ` · ${industry}` : ""
              }.`
            : "Not completed yet."}{" "}
          Re-running the wizard adds any newly-suggested categories without
          touching ones you already have, and re-tailors your agents to the
          profile you confirm.
        </p>
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={handleRerun} disabled={pending}>
            <RotateCcw className="size-4" />
            {pending ? "Opening…" : "Re-run setup"}
          </Button>
        </div>
      </section>
    </div>
  )
}
