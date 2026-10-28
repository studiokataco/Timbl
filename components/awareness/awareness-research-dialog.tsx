"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { addDays, format } from "date-fns"
import { Sparkles } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { AgentChat, type AgentChatHandle } from "@/components/agents/agent-chat"

/*
 * Triggers the awareness-researcher agent. Two-stage flow:
 *   1. Form - date range + optional region.
 *   2. Run - once submitted, swaps to an embedded AgentChat and
 *      auto-sends the structured prompt so the agent starts streaming
 *      immediately. When the stream finishes we refresh the parent page
 *      so the new proposals strip is visible.
 */

const schema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  region: z.string().max(120).optional(),
})
type FormValues = z.infer<typeof schema>

export function AwarenessResearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const router = useRouter()
  const defaults = useMemo<FormValues>(() => {
    const today = new Date()
    return {
      from: format(today, "yyyy-MM-dd"),
      to: format(addDays(today, 90), "yyyy-MM-dd"),
      region: "",
    }
  }, [])
  const [running, setRunning] = useState<FormValues | null>(null)
  const [streaming, setStreaming] = useState(false)
  const chatRef = useRef<AgentChatHandle>(null)
  const submittedKeyRef = useRef<string | null>(null)

  const form = useForm<FormValues>({ defaultValues: defaults })

  function reset() {
    setRunning(null)
    setStreaming(false)
    submittedKeyRef.current = null
    form.reset(defaults)
  }

  /* Closing mid-run tears down the request the agent is streaming into, so
   * the run dies wherever it got to. Say so, stop it deliberately, and
   * refresh - research is incremental, and whatever the agent already
   * proposed is on the board and worth showing. */
  function handleOpenChange(v: boolean) {
    if (!v && streaming) {
      chatRef.current?.stop()
      toast.info("Research stopped", {
        description: "Any days found so far are waiting in your proposals.",
      })
      router.refresh()
    }
    if (!v) reset()
    onOpenChange(v)
  }

  const onSubmit = form.handleSubmit((values) => {
    const parsed = schema.safeParse(values)
    if (!parsed.success) {
      form.setError("from", {
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      })
      return
    }
    setRunning(parsed.data)
  })

  const intro = running
    ? buildIntro(running)
    : undefined

  /* Once the user picks a date range, fire the seeded prompt at the
   * awareness-researcher agent automatically. The `intro` was previously
   * only rendered as static help text, so the chat sat empty until the
   * user retyped it into the composer - making it look like the engine
   * had hung. queueMicrotask defers until the ref is wired post-mount. */
  useEffect(() => {
    if (!running || !intro) return
    const key = `${running.from}|${running.to}|${running.region ?? ""}`
    if (submittedKeyRef.current === key) return
    submittedKeyRef.current = key
    queueMicrotask(() => chatRef.current?.submit(intro))
  }, [running, intro])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="!max-w-2xl !h-[80vh] p-0 flex flex-col">
        <DialogHeader className="px-5 py-3 border-b border-border">
          <DialogTitle className="text-base flex items-center gap-2">
            <Sparkles className="size-4" aria-hidden /> Find new awareness days
          </DialogTitle>
          <DialogDescription className="text-xs">
            The awareness-researcher searches the live web to discover real observances in your
            window. Each finding lands as a proposal you can accept or reject.
          </DialogDescription>
        </DialogHeader>

        {!running ? (
          <form
            onSubmit={onSubmit}
            className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="awareness-from">From</Label>
                <Input
                  id="awareness-from"
                  type="date"
                  {...form.register("from")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="awareness-to">To</Label>
                <Input
                  id="awareness-to"
                  type="date"
                  {...form.register("to")}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="awareness-region">Region (optional)</Label>
              <Input
                id="awareness-region"
                placeholder="Global"
                {...form.register("region")}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank for global observances. Add a country or region to narrow the search.
              </p>
            </div>
            {form.formState.errors.from && (
              <p className="text-xs text-rose-600">
                {form.formState.errors.from.message}
              </p>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                <Sparkles className="size-4" aria-hidden /> Find awareness days
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex-1 min-h-0">
            <AgentChat
              ref={chatRef}
              agentName="awareness-researcher"
              placeholder={`Refine the search or ask a follow-up…`}
              onStreamingChange={setStreaming}
              onFinish={() => router.refresh()}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function buildIntro(values: FormValues): string {
  const region = values.region?.trim()
  const regionClause = region ? ` Focus on ${region}.` : " Focus on global observances."
  return [
    `Find real awareness days, observances, and significant cultural / health / social dates between ${values.from} and ${values.to}.${regionClause}`,
    /* Provider-neutral on purpose: the agent's grounding tool differs per
     * provider, and naming one sends the model hunting for a tool it has
     * not been given. */
    "Search the web to verify every date against a reputable source, then call proposeAwarenessDay for each one. Aim for 5-10 high-quality items.",
  ].join("\n\n")
}
