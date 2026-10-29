"use client"

import { useTransition } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import type { AgentRunDoc } from "@/lib/schemas/agentRun"
import { getAgentSession } from "@/lib/actions/agent-sessions"
import { resolveHumanGate } from "@/lib/actions/agent-suggestions"
import { revertApproval } from "@/lib/actions/approvals"

/*
 * Approve / reject a run parked in `awaiting_human`. Reads the question from
 * the run's requestHumanApproval tool call, resolves the gate through
 * resolveHumanGate, then resumes the run. Approvals carry a 5-second Undo.
 */
export function useApprovalGate(run: AgentRunDoc) {
  const queryClient = useQueryClient()
  const [pending, startTransition] = useTransition()

  const { data: session } = useQuery({
    queryKey: ["studio", "session", run.id],
    queryFn: () => getAgentSession({ runId: run.id, limit: 1_000 }),
    staleTime: 30_000,
  })

  const gate = extractGate(session?.events)

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["studio", "runs"] })
    queryClient.invalidateQueries({ queryKey: ["studio", "session", run.id] })
    queryClient.invalidateQueries({ queryKey: ["posts"] })
  }

  function act(
    decision: "approve" | "reject",
    commentArg?: string,
    onDone?: () => void,
  ) {
    startTransition(async () => {
      const res = await resolveHumanGate({
        runId: run.id,
        decision,
        comment: commentArg,
      })
      if (!res.ok) {
        toast.error("Failed", { description: res.error })
        return
      }
      if (decision === "approve") {
        const logId = res.approvalLogId
        toast.success(approvedTitle(res.nextActionKind), {
          duration: 5_000,
          action: logId
            ? {
                label: "Undo",
                onClick: () => {
                  revertApproval({ approvalLogId: logId }).then((r) => {
                    if (r.ok) {
                      toast.message("Approval reverted")
                      invalidateAll()
                    } else {
                      toast.error("Couldn't undo", { description: r.error })
                    }
                  })
                },
              }
            : undefined,
        })
      } else {
        toast.success("Rejected")
      }
      if (res.resumeRunId && res.resumeToolCallId) {
        fetch(`/api/agents/runs/${res.resumeRunId}/resume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toolCallId: res.resumeToolCallId,
            approved: decision === "approve",
            feedback: commentArg ?? "",
          }),
        }).catch(() => {
          /* surfaced via the run timeline if it fails */
        })
      }
      invalidateAll()
      onDone?.()
    })
  }

  return { gate, act, pending }
}

type SessionEvents = NonNullable<
  Awaited<ReturnType<typeof getAgentSession>>["events"]
>

function extractGate(
  events: SessionEvents | undefined,
): { postId?: string; summary?: string } | null {
  if (!events) return null
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i].event
    if (ev.type !== "tool_call") continue
    const call = ev.call as { name?: string; args?: unknown } | undefined
    if (!call || call.name !== "requestHumanApproval") continue
    const args = (call.args ?? {}) as { postId?: string; summary?: string }
    return { postId: args.postId, summary: args.summary }
  }
  return null
}

function approvedTitle(kind: string | undefined): string {
  switch (kind) {
    case "schedule_post":
      return "Approved & scheduled"
    case "add_to_calendar":
      return "Approved & added to calendar"
    case "create_draft":
      return "Approved - draft created"
    case "instantiate_template":
      return "Approved - template applied"
    case "assign_review":
      return "Approved & assigned"
    default:
      return "Approved"
  }
}
