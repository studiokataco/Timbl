"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { deriveGlance } from "../engine/reducer"
import { useEngine } from "../engine/engine-context"
import { useLiveSession } from "../voice/use-live-session"
import { TOAST_UNDO_MS } from "../lib"
import { useAnnounce } from "../live-announcer"
import { ApproveDeck } from "../mobile/approve-deck"
import { FrameSheet } from "../mobile/frame-sheet"
import { GlanceHome } from "../mobile/glance-home"
import { TalkPanel, TalkSheet } from "../mobile/talk-sheet"
import { ActivityPanel } from "../overlays/activity-surface"
import { PersonaPanel } from "../overlays/persona-presence-sheet"
import { ApprovalCard } from "../primitives/approval-card"
import { AssistantAvatar } from "../primitives/presence-orb"
import { usePrototype } from "../prototype-context"
import { TimblModeView } from "./timbl-mode-view"
import type { GlanceTarget } from "../types"

export function MobileView(): React.JSX.Element {
  const { copy, view, update, dismiss, viewer, team, role, prefs, assistantName, setAssistantName, setPrefs } =
    usePrototype()
  const { state, dispatch } = useEngine()
  const announce = useAnnounce()
  const [holding, setHolding] = useState(false)
  const [activityTab, setActivityTab] = useState<"needs" | "log">("needs")
  const [containerWidth, setContainerWidth] = useState(1440)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const voice = useLiveSession()
  const effectiveTalkState = view.talk ?? voice.talkState
  const deckLock = useRef(new Set<string>())
  const deckEntries = state.deck.order.map((postId) => ({
    postId,
    brandCheck: { ok: true, note: "" },
  }))

  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setContainerWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (view.sheet === "approve-all" && state.deck.order.length > 0) {
      dispatch({ type: "bulk_requested", postIds: state.deck.order })
    }
  }, [dispatch, state.deck.order, view.sheet])

  const cards = deriveGlance(state, viewer, copy)
  const statusLine = copy.mobile.glance.status(
    state.deck.order.length + (state.glance.reconnectDays !== null ? 1 : 0),
  )

  const handleGlanceAction = (target: GlanceTarget) => {
    if (target === "approve_all") {
      dispatch({ type: "bulk_requested", postIds: state.deck.order })
      update({ sheet: "approve-all" }, "push")
    } else if (target === "review") {
      update({ screen: "approve" }, "push")
    } else if (target === "reconnect") {
      toast(copy.mobile.glance.reconnectToast, { position: "top-center" })
    } else if (target === "plan") {
      dispatch({ type: "user_sent", text: copy.mobile.glance.planPrompt, source: "chip" })
      update({ screen: "chat" }, "push")
    }
  }

  const bulkRequest =
    state.requests.find((r) => r.action === "bulk_approve" && r.status === "pending") ??
    state.requests[state.requests.length - 1]

  const currentDeckPostId = state.deck.order[state.deck.index]

  const handleDeckApprove = () => {
    if (!currentDeckPostId) return
    const rev = state.posts[currentDeckPostId]?.contentRev ?? 0
    const key = `${currentDeckPostId}:${rev}:deck`
    if (deckLock.current.has(key)) return
    deckLock.current.add(key)
    const outcome = role === "contributor" ? "submitted" : "approved"
    dispatch({ type: "deck_decided", postId: currentDeckPostId, outcome })
    toast(copy.mobile.deck.approvedToast, {
      position: "top-center",
      duration: TOAST_UNDO_MS,
      action: {
        label: copy.mobile.deck.undo,
        onClick: () => dispatch({ type: "deck_undo" }),
      },
    })
  }

  const handleDeckSkip = () => {
    if (!currentDeckPostId) return
    dispatch({ type: "deck_decided", postId: currentDeckPostId, outcome: "skipped" })
  }

  const handleDeckRefine = (kind: "shorter" | "funnier" | "new_image") => {
    if (!currentDeckPostId) return
    dispatch({ type: "deck_refine", postId: currentDeckPostId, kind })
    announce(kind === "new_image" ? copy.mobile.deck.imageUpdated : copy.mobile.deck.captionUpdated)
  }

  const sendHeard = () => {
    const text = voice.consume()
    void voice.close()
    if (!text) return
    if (view.screen === "approve") {
      if (/^approve\b/i.test(text)) {
        handleDeckApprove()
        update({ sheet: null, voice: null })
        return
      }
      if (/\bskip\b/i.test(text)) {
        handleDeckSkip()
        update({ sheet: null, voice: null })
        return
      }
      if (/\b(shorter|tighten)\b/i.test(text)) {
        handleDeckRefine("shorter")
        update({ sheet: null, voice: null })
        return
      }
      if (/\bfunnier\b/i.test(text)) {
        handleDeckRefine("funnier")
        update({ sheet: null, voice: null })
        return
      }
      if (/\bnew image\b/i.test(text)) {
        handleDeckRefine("new_image")
        update({ sheet: null, voice: null })
        return
      }
    }
    dispatch({ type: "user_sent", text, source: "voice" })
    update({ screen: "chat", sheet: null, voice: null })
  }

  useEffect(() => {
    if (!view.voice) return
    if (view.voice === "reschedule" || view.voice === "plan") {
      update({ screen: "chat", sheet: null })
      return
    }
    if (view.sheet === "talk") update({ sheet: null })
  }, [update, view.sheet, view.voice])

  const renderSingleFrame = (framed: boolean) => (
    <>
          {view.screen === "glance" ? (
        <GlanceHome
          cards={cards}
          status={statusLine}
          framed={framed}
          onAction={handleGlanceAction}
          onAsk={() => update({ screen: "chat" }, "push")}
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
          onRefine={handleDeckRefine}
          onApprove={handleDeckApprove}
          onSkip={handleDeckSkip}
          onMic={() => {
            void voice.startTalk()
            update({ sheet: "talk" }, "push")
          }}
          onBack={() => update({ screen: "glance" })}
          onReviewSkipped={() => dispatch({ type: "reset", scene: view.scene, usage: view.usage, canvas: view.canvas })}
          onKeyCommand={(cmd) => (cmd === "approve" ? handleDeckApprove() : handleDeckSkip())}
        />
      ) : (
        <TimblModeView chrome="mobile-screen" onBack={() => update({ screen: "glance" })} />
      )}

      {/* Talk sheet inside phone frame */}
      <TalkSheet
        open={view.sheet === "talk"}
        state={effectiveTalkState}
        tokens={voice.tokens}
        chips={voice.chips}
        level={voice.level}
        workspace={copy.iface.sidebar.workspace}
        framed={framed}
        holding={holding}
        onOrb={() => {
          if (voice.talkState === "listening") sendHeard()
          else void voice.startTalk()
        }}
        onHoldStart={() => {
          setHolding(true)
          void voice.startTalk()
        }}
        onHoldEnd={() => {
          setHolding(false)
          sendHeard()
        }}
        onPermission={(granted) => {
          if (granted) void voice.startTalk()
          else void voice.close()
        }}
        onClose={() => {
          void voice.close()
          dismiss({ sheet: null })
        }}
        onTypeInstead={() => {
          void voice.close()
          update({ screen: "chat", sheet: null })
        }}
        onRetry={() => void voice.startTalk()}
      />

      {/* Bulk approve sheet inside phone frame */}
      <FrameSheet
        open={view.sheet === "approve-all"}
        onClose={() => dismiss({ sheet: null })}
        title={copy.approval.meta}
      >
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

      {/* Activity panel inside phone frame */}
      <FrameSheet
        open={view.sheet === "activity"}
        onClose={() => dismiss({ sheet: null })}
        title={copy.activity.title}
      >
        <ActivityPanel
          tab={activityTab}
          onTab={setActivityTab}
          needs={[]}
          log={state.activity}
          runs={state.runs}
          team={team}
          posts={state.posts}
          assistantAvatar={<AssistantAvatar />}
        />
      </FrameSheet>

      {/* Persona panel inside phone frame */}
      <FrameSheet
        open={view.sheet === "persona"}
        onClose={() => dismiss({ sheet: null })}
        title={copy.persona.title}
      >
        <PersonaPanel
          role={role}
          assistantName={assistantName}
          prefs={prefs}
          inFrame
          onSave={(name, nextPrefs) => {
            setAssistantName(name)
            setPrefs(nextPrefs)
            toast(copy.persona.saved, { position: "top-center" })
            dismiss({ sheet: null })
          }}
          onCancel={() => dismiss({ sheet: null })}
        />
      </FrameSheet>
    </>
  )

  if (view.layout === "board" && containerWidth >= 1280) {
    const b = copy.mobile.board
    return (
      <div
        ref={rootRef}
        data-slot="agentic-mobile-view"
        data-state="board"
        data-figma="MobileView/board"
        className="@container/mobileview flex min-h-0 flex-1 flex-col items-center overflow-y-auto bg-muted"
      >
        <div className="flex flex-wrap justify-center gap-12 p-10">
          <div className="flex flex-col gap-3">
            <div className="max-w-97.5">
              <h2 className="text-title-sm text-foreground">{b.talkTitle}</h2>
              <p className="text-caption text-muted-foreground">{b.talkBody}</p>
            </div>
                          <TalkPanel
                state={voice.talkState}
                tokens={voice.tokens}
                chips={voice.chips}
                level={voice.level}
                workspace={copy.iface.sidebar.workspace}
                framed
                onOrb={() => {}}
                onHoldStart={() => {}}
                onHoldEnd={() => {}}
                onPermission={() => {}}
                onClose={() => {}}
                onTypeInstead={() => {}}
                onRetry={() => {}}
              />
                  </div>

          <div className="flex flex-col gap-3">
            <div className="max-w-97.5">
              <h2 className="text-title-sm text-foreground">{b.glanceTitle}</h2>
              <p className="text-caption text-muted-foreground">{b.glanceBody}</p>
            </div>
                          <GlanceHome
                cards={cards}
                status={statusLine}
                framed
                onAction={handleGlanceAction}
                onAsk={() => update({ layout: "single", screen: "chat" })}
                onSpeak={() => update({ layout: "single", sheet: "talk" })}
              />
                  </div>

          <div className="flex flex-col gap-3">
            <div className="max-w-97.5">
              <h2 className="text-title-sm text-foreground">{b.approveTitle}</h2>
              <p className="text-caption text-muted-foreground">{b.approveBody}</p>
            </div>
                          <ApproveDeck
                entries={deckEntries}
                posts={state.posts}
                index={0}
                decisions={state.deck.decisions}
                refining={state.deck.refining}
                viewerRole={role}
                framed
                onRefine={handleDeckRefine}
                onApprove={handleDeckApprove}
                onSkip={handleDeckSkip}
                onMic={() => {}}
                onBack={() => {}}
                onReviewSkipped={() => {}}
                onKeyCommand={() => {}}
              />
                  </div>
        </div>
      </div>
    )
  }

  const isFramed = containerWidth >= 448

  return (
    <div
      ref={rootRef}
      data-slot="agentic-mobile-view"
      data-state={view.screen}
      data-figma="MobileView/root"
      className="@container/mobileview flex min-h-0 flex-1 flex-col items-center overflow-y-auto bg-muted"
    >
      {isFramed ? (
        <div className="flex py-8">{renderSingleFrame(true)}</div>
      ) : (
        <div className="flex min-h-full w-full flex-1">{renderSingleFrame(false)}</div>
      )}
    </div>
  )
}
