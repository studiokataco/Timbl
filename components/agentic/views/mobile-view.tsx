"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { deriveGlance } from "../engine/reducer"
import { useEngine } from "../engine/engine-context"
import { applySpokenTool, useLiveSession } from "../voice/use-live-session"
import { useScriptedUtterance } from "../voice/scripted"
import { ApproveDeck } from "../mobile/approve-deck"
import { FrameSheet } from "../mobile/frame-sheet"
import { GlanceHome } from "../mobile/glance-home"
import { TalkSheet } from "../mobile/talk-sheet"
import { ActivityPanel } from "../overlays/activity-surface"
import { usePendingApprovals, useSavePersona } from "../overlays/pending-approvals"
import { PersonaPanel } from "../overlays/persona-presence-sheet"
import { ApprovalCard } from "../primitives/approval-card"
import { AssistantAvatar } from "../primitives/presence-orb"
import { usePrototype } from "../prototype-context"
import { TimblModeView } from "./timbl-mode-view"
import type { GlanceTarget, RefineKind } from "../types"

const SPOKEN: { match: RegExp; act: "approve" | "skip" | RefineKind }[] = [
  { match: /^approve\b/i, act: "approve" },
  { match: /\bskip\b/i, act: "skip" },
  { match: /\b(shorter|tighten)\b/i, act: "shorter" },
  { match: /\bfunnier\b/i, act: "funnier" },
  { match: /\bnew image\b/i, act: "new_image" },
]

export function MobileView({
  lead,
  modeSwitch,
  titleSlot,
}: {
  lead?: React.ReactNode
  modeSwitch?: React.ReactNode
  titleSlot?: React.ReactNode
} = {}): React.JSX.Element {
  const { copy, view, update, dismiss, team, role, prefs, assistantName } = usePrototype()
  const { state, dispatch } = useEngine()
  const [holding, setHolding] = useState(false)
  const [activityTab, setActivityTab] = useState<"needs" | "log">("needs")
  const [containerWidth, setContainerWidth] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const bulkOpened = useRef(false)
  const voice = useLiveSession({
    onTool: (tool) => applySpokenTool(tool, dispatch, state.deck.order[state.deck.index] ?? null),
    instruction: copy.prompts.liveSystem,
  })
  const needs = usePendingApprovals()
  const savePersona = useSavePersona(() => dismiss({ sheet: null }))
  const remaining = state.deck.order.slice(state.deck.index)
  const deckEntries = state.deck.order.map((postId) => ({ postId, brandCheck: { ok: true, note: "" } }))
  const currentDeckPostId = state.deck.order[state.deck.index]
  useScriptedUtterance(dispatch, currentDeckPostId ?? null)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const apply = () => {
      const w = el.getBoundingClientRect().width
      if (w) setContainerWidth(w)
    }
    apply()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (view.sheet !== "approve-all") {
      bulkOpened.current = false
      return
    }
    if (bulkOpened.current || remaining.length === 0) return
    bulkOpened.current = true
    dispatch({ type: "bulk_requested", postIds: remaining })
  }, [dispatch, remaining, view.sheet])

  const cards = deriveGlance(state, copy)
  const statusLine = copy.mobile.glance.status(remaining.length + (state.glance.reconnectDays !== null ? 1 : 0))

  const handleGlanceAction = (target: GlanceTarget) => {
    if (target === "approve_all") update({ sheet: "approve-all" }, "push")
    else if (target === "review") update({ screen: "approve" }, "push")
    else if (target === "reconnect") toast(copy.mobile.glance.reconnectToast, { position: "top-center" })
    else {
      const event = state.glance.events[0]
      dispatch({ type: "user_sent", text: event ? copy.mobile.glance.planPrompt(event.name) : copy.mobile.glance.planGeneric, source: "chip" })
      update({ screen: "chat" }, "push")
    }
  }

  const bulkRequest = [...state.requests].reverse().find((r) => r.action === "bulk_approve")

  const decide = (act: "approve" | "skip" | RefineKind) => {
    if (!currentDeckPostId) return
    if (act === "approve") dispatch({ type: "deck_decided", postId: currentDeckPostId, outcome: role === "contributor" ? "submitted" : "approved" })
    else if (act === "skip") dispatch({ type: "deck_decided", postId: currentDeckPostId, outcome: "skipped" })
    else dispatch({ type: "deck_refine", postId: currentDeckPostId, kind: act })
  }

  const sendHeard = () => {
    const text = voice.consume()
    void voice.close()
    if (!text) return
    const spoken = view.screen === "approve" ? SPOKEN.find((item) => item.match.test(text)) : undefined
    if (spoken) {
      decide(spoken.act)
      dismiss({ sheet: null })
      return
    }
    dispatch({ type: "user_sent", text, source: "voice" })
    update({ screen: "chat", sheet: null })
  }

  const framed = containerWidth >= 448

  return (
    <div
      ref={rootRef}
      data-slot="agentic-mobile-view"
      data-state={view.screen}
      data-figma="MobileView/root"
      className="@container/mobileview flex min-h-0 flex-1 flex-col items-center overflow-y-auto bg-muted"
    >
      <div className={framed ? "flex py-8" : "flex min-h-full w-full flex-1"}>
        {view.screen === "glance" ? (
          <GlanceHome
            cards={cards}
            status={statusLine}
            framed={framed}
            onAction={handleGlanceAction}
            onAsk={() => update({ screen: "chat" }, "push")}
            lead={lead}
            trailing={modeSwitch}
            onSpeak={() => {
              void voice.startTalk()
              update({ sheet: "talk" }, "push")
            }}
          />
        ) : view.screen === "approve" ? (
          <ApproveDeck
            entries={deckEntries}
            posts={state.posts}
            index={state.deck.index}
            decisions={state.deck.decisions}
            refining={state.deck.refining}
            viewerRole={role}
            framed={framed}
            onRefine={(kind) => decide(kind)}
            onApprove={() => decide("approve")}
            onSkip={() => decide("skip")}
            onMic={() => {
              void voice.startTalk()
              update({ sheet: "talk" }, "push")
            }}
            onBack={() => update({ screen: "glance" })}
            onReviewSkipped={() => dispatch({ type: "deck_review_skipped" })}
            onKeyCommand={(cmd) => decide(cmd === "approve" ? "approve" : "skip")}
          />
        ) : (
          <TimblModeView chrome="mobile-screen" titleSlot={titleSlot} onBack={() => update({ screen: "glance" })} />
        )}

        <TalkSheet
          open={view.sheet === "talk"}
          state={voice.talkState}
          tokens={voice.tokens}
          chips={voice.chips}
          level={voice.level}
          workspace={copy.iface.sidebar.workspace}
          framed={framed}
          holding={holding}
          onOrb={() => (voice.talkState === "listening" ? sendHeard() : void voice.startTalk())}
          onHoldStart={() => {
            setHolding(true)
            void voice.startTalk()
          }}
          onHoldEnd={() => {
            setHolding(false)
            sendHeard()
          }}
          onPermission={(granted) => (granted ? void voice.startTalk() : void voice.close())}
          onClose={() => {
            void voice.close()
            dismiss({ sheet: null })
          }}
          onTypeInstead={() => {
            const heard = voice.consume()
            void voice.close()
            if (heard) dispatch({ type: "composer_draft", text: heard })
            update({ screen: "chat", sheet: null })
          }}
          onRetry={() => void voice.startTalk()}
        />

        <FrameSheet open={view.sheet === "approve-all"} onClose={() => dismiss({ sheet: null })} title={copy.approval.meta}>
          {bulkRequest ? (
            <ApprovalCard
              request={bulkRequest}
              posts={bulkRequest.postIds.map((id) => state.posts[id]).filter((p): p is NonNullable<typeof p> => Boolean(p))}
              viewerRole={role}
              onApprove={() => {
                dispatch({ type: "request_resolved", requestId: bulkRequest.id, outcome: "approved" })
                dismiss({ sheet: null })
              }}
              onRequestChanges={(feedback) => {
                dispatch({ type: "request_resolved", requestId: bulkRequest.id, outcome: "changes_requested", feedback })
                dismiss({ sheet: null })
              }}
              onSubmit={() => {
                dispatch({ type: "request_resolved", requestId: bulkRequest.id, outcome: "approved" })
                dismiss({ sheet: null })
              }}
            />
          ) : null}
        </FrameSheet>

        <FrameSheet open={view.sheet === "activity"} onClose={() => dismiss({ sheet: null })} title={copy.activity.title}>
          <ActivityPanel
            tab={activityTab}
            onTab={setActivityTab}
            needs={needs}
            log={state.activity}
            runs={state.runs}
            team={team}
            posts={state.posts}
            assistantAvatar={<AssistantAvatar />}
          />
        </FrameSheet>

        <FrameSheet open={view.sheet === "persona"} onClose={() => dismiss({ sheet: null })} title={copy.persona.title}>
          <PersonaPanel role={role} assistantName={assistantName} prefs={prefs} inFrame onSave={savePersona} onCancel={() => dismiss({ sheet: null })} />
        </FrameSheet>
      </div>
    </div>
  )
}
