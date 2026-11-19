"use client"

import { toast } from "sonner"
import { savePersona } from "@/lib/actions/persona"
import { useEngine } from "../engine/engine-context"
import { ApprovalCard } from "../primitives/approval-card"
import { usePrototype } from "../prototype-context"
import type { PresencePrefs } from "../types"

export function usePendingApprovals(): React.ReactNode[] {
  const { role } = usePrototype()
  const { state, dispatch } = useEngine()
  return state.requests
    .filter((request) => request.status === "pending")
    .map((request) => (
      <ApprovalCard
        key={request.id}
        compact
        request={request}
        posts={request.postIds.map((id) => state.posts[id]).filter((post) => Boolean(post))}
        viewerRole={role}
        onApprove={() => dispatch({ type: "request_resolved", requestId: request.id, outcome: "approved" })}
        onRequestChanges={(feedback) => dispatch({ type: "request_resolved", requestId: request.id, outcome: "changes_requested", feedback })}
        onSubmit={() => dispatch({ type: "request_resolved", requestId: request.id, outcome: "approved" })}
      />
    ))
}

export function useSavePersona(onDone: () => void) {
  const { copy, setAssistantName, setPrefs } = usePrototype()
  return async (name: string, prefs: PresencePrefs) => {
    const result = await savePersona({ assistantName: name, ...prefs, showCursors: Boolean(prefs.showCursors) })
    if (!result.ok) {
      toast.error(result.error ?? copy.persona.saveFailed)
      return
    }
    setAssistantName(name)
    setPrefs(prefs)
    toast(copy.persona.saved)
    onDone()
  }
}
