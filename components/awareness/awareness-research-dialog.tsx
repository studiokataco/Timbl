"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { useQueryClient } from "@tanstack/react-query"
import { addDays, format, parseISO } from "date-fns"
import { CircleCheck, MessageSquare, Sparkles } from "lucide-react"
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
import { useWorkspaceOrgId } from "@/components/shared/workspace-provider"
import {
  appendMessage,
  createThread,
  renameThread,
  type ThreadMessage,
} from "@/lib/storage/agent-threads"

/*
 * Triggers the awareness-researcher agent. Two-stage flow:
 *   1. Form - date range + optional region.
 *   2. Run - once submitted, swaps to an embedded AgentChat and
 *      auto-sends the structured prompt so the agent starts streaming
 *      immediately. The run is saved as an agent chat thread, so it shows
 *      up in chat history and can be continued from the agent drawer.
 *      When a turn finishes, a footer states the outcome and the next step.
 */

const PROPOSE_TOOL = "proposeAwarenessDay"

type Tally = { proposed: number; skipped: number }

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
  const qc = useQueryClient()
  const orgId = useWorkspaceOrgId()
  const defaults = useMemo<FormValues>(() => {
    const today = new Date()
    return {
      from: format(today, "yyyy-MM-dd"),
      to: format(addDays(today, 90), "yyyy-MM-dd"),
      region: "",
    }
  }, [])
  const [running, setRunning] = useState<FormValues | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [finishedTurns, setFinishedTurns] = useState(0)
  const [tallies, setTallies] = useState<Record<string, Tally>>({})
  const chatRef = useRef<AgentChatHandle>(null)
  const submittedKeyRef = useRef<string | null>(null)

  const form = useForm<FormValues>({ defaultValues: defaults })

  function reset() {
    setRunning(null)
    setThreadId(null)
    setStreaming(false)
    setFinishedTurns(0)
    setTallies({})
    submittedKeyRef.current = null
    form.reset(defaults)
  }

  const handleMessage = useCallback(
    (msg: ThreadMessage) => {
      if (!threadId) return
      void appendMessage(threadId, msg).then(() =>
        qc.invalidateQueries({ queryKey: ["agent-threads", orgId] }),
      )
      if (msg.role !== "assistant") return
      const calls = msg.toolCalls?.filter((c) => c.name === PROPOSE_TOOL) ?? []
      if (calls.length === 0) return
      const tally: Tally = { proposed: 0, skipped: 0 }
      for (const c of calls) {
        const ok = (c.result as { ok?: unknown } | undefined)?.ok
        if (ok === true) tally.proposed++
        else if (ok === false || c.error) tally.skipped++
      }
      setTallies((prev) => ({ ...prev, [msg.id]: tally }))
    },
    [threadId, qc, orgId],
  )

  const handleFinish = useCallback(() => {
    setFinishedTurns((n) => n + 1)
    router.refresh()
  }, [router])

  const total = useMemo(
    () =>
      Object.values(tallies).reduce(
        (acc, t) => ({
          proposed: acc.proposed + t.proposed,
          skipped: acc.skipped + t.skipped,
        }),
        { proposed: 0, skipped: 0 },
      ),
    [tallies],
  )

  function reviewProposals() {
    handleOpenChange(false)
    window.setTimeout(() => {
      document
        .getElementById("awareness-proposals")
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 250)
  }

  function continueInChat() {
    if (!threadId) return
    const id = threadId
    handleOpenChange(false)
    window.dispatchEvent(
      new CustomEvent("agent-drawer:open-thread", { detail: { threadId: id } }),
    )
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

  const onSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.safeParse(values)
    if (!parsed.success) {
      form.setError("from", {
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      })
      return
    }
    const thread = await createThread("awareness-researcher", orgId)
    await renameThread(thread.id, threadTitle(parsed.data))
    void qc.invalidateQueries({ queryKey: ["agent-threads", orgId] })
    setThreadId(thread.id)
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
    if (!running || !intro || !threadId) return
    const key = `${running.from}|${running.to}|${running.region ?? ""}`
    if (submittedKeyRef.current === key) return
    submittedKeyRef.current = key
    queueMicrotask(() => chatRef.current?.submit(intro))
  }, [running, intro, threadId])

  const showOutcome = finishedTurns > 0 && !streaming

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
              <Button type="submit" disabled={form.formState.isSubmitting}>
                <Sparkles className="size-4" aria-hidden /> Find awareness days
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex-1 min-h-0">
              {threadId && (
                <AgentChat
                  ref={chatRef}
                  agentName="awareness-researcher"
                  threadId={threadId}
                  organizationId={orgId}
                  onMessage={handleMessage}
                  placeholder="Ask for more days, a different region, or a fix…"
                  onStreamingChange={setStreaming}
                  onFinish={handleFinish}
                />
              )}
            </div>
            {showOutcome && (
              <div className="border-t border-border px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <CircleCheck
                    className="size-4 mt-0.5 shrink-0 text-foreground"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="text-body-sm font-semibold text-foreground">
                      {outcomeTitle(total)}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      {total.proposed > 0
                        ? "Accept or reject each one on this page. This run is saved in your agent chats."
                        : "Try a wider window or another region. This run is saved in your agent chats."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button type="button" variant="outline" size="sm" onClick={continueInChat}>
                    <MessageSquare className="size-4" aria-hidden />
                    Continue in chat
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={total.proposed > 0 ? reviewProposals : () => handleOpenChange(false)}
                  >
                    {total.proposed > 0 ? "Review proposals" : "Done"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function outcomeTitle({ proposed, skipped }: Tally): string {
  if (proposed === 0) return "No new awareness days found"
  const days = `${proposed} awareness day${proposed === 1 ? "" : "s"} ready to review`
  return skipped > 0 ? `${days} · ${skipped} skipped` : days
}

function threadTitle(values: FormValues): string {
  const range = `${format(parseISO(values.from), "d MMM")} to ${format(parseISO(values.to), "d MMM yyyy")}`
  const region = values.region?.trim() || "Global"
  return `Awareness days · ${region} · ${range}`
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
