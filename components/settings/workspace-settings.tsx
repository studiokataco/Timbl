"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { RotateCcw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { resetOnboarding } from "@/lib/actions/onboarding"

export function WorkspaceSettings({
  completedAt,
  industry,
}: {
  completedAt?: string
  industry?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

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

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium">Setup wizard</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {completedAt
            ? `Completed ${new Date(completedAt).toLocaleDateString()}${
                industry ? ` · ${industry}` : ""
              }.`
            : "Not completed yet."}{" "}
          Re-running the wizard adds any newly-suggested categories without
          touching ones you already have.
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
