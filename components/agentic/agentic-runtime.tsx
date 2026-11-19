"use client"

import { createContext, useCallback, useContext, useRef, useState } from "react"
import { MotionConfig, useReducedMotion } from "framer-motion"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { WithId } from "@/lib/firebase/serialize"
import type { Post } from "@/lib/schemas"
import { EngineProvider, useEngine } from "@/components/agentic/engine/engine-context"
import { EngineBridge } from "@/components/agentic/engine/use-engine-bridge"
import { usePersist } from "@/components/agentic/engine/persist"
import { HandoffProvider } from "@/components/agentic/handoff/handoff-context"
import { HandoffTransition } from "@/components/agentic/handoff/handoff-transition"
import { REDUCED_POPUP, TOAST_UNDO_MS, tw } from "@/components/agentic/lib"
import { LiveAnnouncerProvider, useAnnounce } from "@/components/agentic/live-announcer"
import { AssistantAvatar } from "@/components/agentic/primitives/presence-orb"
import { PrototypeProvider, useAgenticMotion, usePrototype } from "@/components/agentic/prototype-context"
import type { EngineEffect, EngineEvent, PresencePrefs, TeamMember, ViewState } from "@/components/agentic/types"
import { ActivitySurface } from "@/components/agentic/overlays/activity-surface"
import { usePendingApprovals, useSavePersona } from "@/components/agentic/overlays/pending-approvals"
import { PersonaPresenceSheet } from "@/components/agentic/overlays/persona-presence-sheet"
import { ContributorApproval } from "@/components/agentic/collab/contributor-approval"
import { NoteThread } from "@/components/agentic/collab/note-thread"
import { TalkSheet } from "@/components/agentic/mobile/talk-sheet"
import { applySpokenTool, useLiveSession } from "@/components/agentic/voice/use-live-session"
import { useScriptedUtterance } from "@/components/agentic/voice/scripted"

export type NavigateEffect = Extract<EngineEffect, { type: "navigate" }>

type Flush = () => Promise<void>
const ThreadFlushContext = createContext<{ current: Flush | null } | null>(null)

export function useThreadFlush(): Flush {
  const ref = useContext(ThreadFlushContext)
  return useCallback(async () => {
    await ref?.current?.()
  }, [ref])
}

export function AgenticProviders({
  team,
  viewerId,
  workspaceName,
  assistantName,
  prefs,
  initialView,
  children,
}: {
  team: TeamMember[]
  viewerId: string
  workspaceName: string
  assistantName: string
  prefs: PresencePrefs
  initialView: ViewState
  children: React.ReactNode
}) {
  const viewer = team.find((member) => member.id === viewerId) ?? team[0]
  return (
    <PrototypeProvider
      initialView={initialView}
      viewer={viewer}
      team={team}
      workspaceName={workspaceName}
      assistantName={assistantName}
      prefs={prefs}
    >
      <LiveAnnouncerProvider>{children}</LiveAnnouncerProvider>
    </PrototypeProvider>
  )
}

type AgenticRuntimeProps = {
  children: React.ReactNode
  cadencePerWeek: number
  campaignCount: number
  posts: WithId<Post>[]
  events?: { name: string; date: string }[]
  surfaceContext: string
  threadId?: string
  onSaved?: () => void
  onNavigate: (effect: NavigateEffect) => void
}

export function AgenticRuntime({
  children,
  cadencePerWeek,
  campaignCount,
  posts,
  events,
  surfaceContext,
  threadId,
  onSaved,
  onNavigate,
}: AgenticRuntimeProps) {
  const { update, prefs, copy } = usePrototype()
  const announce = useAnnounce()
  const persist = usePersist(useCallback((message: string) => toast.error(message), []))
  const flushRef = useRef<Flush | null>(null)
  const onEffect = useCallback(
    (effect: EngineEffect, dispatch: (event: EngineEvent) => void) => {
      if (effect.type === "persist") void persist(effect.op, dispatch)
      else if (effect.type === "toast") {
        const undo = effect.undo
        toast(effect.message, {
          id: effect.id,
          duration: undo ? TOAST_UNDO_MS : 4000,
          ...(effect.position ? { position: effect.position } : {}),
          action: undo ? { label: copy.approval.undoInline, onClick: () => dispatch(undo) } : undefined,
        })
      } else if (effect.type === "announce") announce(effect.message, effect.assertive ? "assertive" : "polite")
      else if (effect.type === "navigate") onNavigate(effect)
      else if (effect.type === "open_sheet") update({ sheet: effect.sheet, ...(effect.post ? { post: effect.post } : {}) }, "push")
      else if (effect.type === "canvas_shown") update({ canvas: "shown" })
      else if (effect.type === "scroll_to") {
        document.querySelector<HTMLElement>("[data-slot=agentic-approval-card]")?.scrollIntoView({ block: "nearest" })
      } else if (effect.type === "focus_composer") {
        window.setTimeout(() => document.querySelector<HTMLTextAreaElement>("#timbl-composer, [data-slot=agentic-flyout-panel] textarea")?.focus(), 40)
      }
    },
    [announce, copy.approval.undoInline, onNavigate, persist, update],
  )
  return (
    <MotionConfig reducedMotion={prefs.reduceMotion ? "always" : "user"}>
      <EngineProvider cadence={cadencePerWeek} campaigns={campaignCount} onEffect={onEffect}>
        <EngineBridge posts={posts} events={events} surfaceContext={surfaceContext} threadId={threadId} onSaved={onSaved} flushRef={flushRef} />
        <ThreadFlushContext.Provider value={flushRef}>
          <HandoffProvider>
            <HandoffTransition />
            {children}
            <OrbSheets />
          </HandoffProvider>
        </ThreadFlushContext.Provider>
      </EngineProvider>
    </MotionConfig>
  )
}

export function useReducedMotionAttr(): string | undefined {
  const { prefs } = usePrototype()
  const osReduced = useReducedMotion()
  return prefs.reduceMotion || osReduced ? "" : undefined
}

export function OrbSheets() {
  const { view, dismiss, prefs, assistantName, role, copy, team, viewer } = usePrototype()
  const { state, dispatch } = useEngine()
  const { reduced } = useAgenticMotion()
  const [tab, setTab] = useState<"needs" | "log">("needs")
  const voice = useLiveSession({
    onTool: (tool) => applySpokenTool(tool, dispatch, state.deck.order[state.deck.index] ?? null),
    instruction: copy.prompts.liveSystem,
  })
  useScriptedUtterance(dispatch, state.deck.order[state.deck.index] ?? null)
  const savePersona = useSavePersona(() => dismiss({ sheet: null }))
  const needs = usePendingApprovals()
  const notesPost = view.post ? state.posts[view.post] : undefined
  const notesSubmission = notesPost ? state.submissions.find((item) => item.postId === notesPost.id) ?? null : null
  const notesList = notesPost ? state.notes.filter((note) => note.postId === notesPost.id) : []
  const notesLastRead = notesPost ? state.reads.find((read) => read.postId === notesPost.id && read.userId === viewer.id)?.lastReadAt : undefined
  const sendHeard = () => {
    const text = voice.consume()
    void voice.close()
    if (text) dispatch({ type: "user_sent", text, source: "voice" })
  }
  return (
    <>
      <ActivitySurface
        open={view.sheet === "activity"}
        onOpenChange={(open) => !open && dismiss({ sheet: null })}
        layout="side"
        finalFocus={() => document.querySelector<HTMLElement>("[data-slot=agentic-state-chip], [data-figma='OrbDock/label'], [data-slot=agentic-orb-dock] button")}
        reduced={reduced}
        tab={tab}
        onTab={setTab}
        needs={needs}
        log={state.activity}
        runs={state.runs}
        team={team}
        posts={state.posts}
        assistantAvatar={<AssistantAvatar />}
      />
      <PersonaPresenceSheet
        open={view.sheet === "persona"}
        onOpenChange={(open) => !open && dismiss({ sheet: null })}
        layout="side"
        finalFocus={() => document.querySelector<HTMLElement>("[aria-label='" + copy.iface.rail.settings + "'], h1")}
        reduced={reduced}
        role={role}
        assistantName={assistantName}
        prefs={prefs}
        inFrame={false}
        onSave={savePersona}
        onCancel={() => dismiss({ sheet: null })}
      />
      <TalkSheet
        open={view.sheet === "talk" && view.view !== "mobile"}
        state={voice.talkState}
        tokens={voice.tokens}
        chips={voice.chips}
        level={voice.level}
        workspace={copy.iface.sidebar.workspace}
        framed={false}
        onOrb={() => (voice.talkState === "listening" ? sendHeard() : void voice.startTalk())}
        onHoldStart={() => void voice.startTalk()}
        onHoldEnd={sendHeard}
        onPermission={(granted) => (granted ? void voice.startTalk() : void voice.close())}
        onClose={() => {
          void voice.close()
          dismiss({ sheet: null })
        }}
        onTypeInstead={() => {
          void voice.close()
          dismiss({ sheet: null })
        }}
        onRetry={() => void voice.startTalk()}
      />
      <Sheet open={view.sheet === "notes" && Boolean(notesPost)} onOpenChange={(open) => !open && dismiss({ sheet: null })}>
        <SheetContent
          side="right"
          initialFocus={() => document.querySelector<HTMLElement>("[data-slot=agentic-note-thread] textarea")}
          finalFocus={() => document.querySelector<HTMLElement>(`[data-post-id="${view.post ?? ""}"]`) ?? document.querySelector<HTMLElement>("h1")}
          className={tw("flex flex-col gap-4 overflow-y-auto p-5", reduced && REDUCED_POPUP)}
        >
          <SheetHeader className="p-0">
            <SheetTitle>
              <span className="text-title-md text-foreground">{copy.iface.calendar.notesTitle(notesPost?.brief ?? "")}</span>
            </SheetTitle>
          </SheetHeader>
          {notesPost && notesSubmission ? (
            <ContributorApproval
              post={notesPost}
              submission={notesSubmission}
              viewer={viewer}
              team={team}
              onApprove={() => dispatch({ type: "submission_decided", postId: notesPost.id, outcome: "approved" })}
              onSendBack={(reason, note) => dispatch({ type: "submission_decided", postId: notesPost.id, outcome: "sent_back", reason, note })}
              onWithdraw={() => dispatch({ type: "submission_withdrawn", postId: notesPost.id })}
            />
          ) : null}
          {notesPost ? (
            <NoteThread
              post={notesPost}
              notes={notesList}
              team={team}
              viewerId={viewer.id}
              lastReadAt={notesLastRead}
              density="panel"
              assistantAvatar={<AssistantAvatar />}
              onAdd={(body) => dispatch({ type: "note_added", postId: notesPost.id, body })}
              onEdit={(noteId, body) => dispatch({ type: "note_edited", noteId, body })}
              onDelete={(noteId) => dispatch({ type: "note_deleted", noteId })}
              onReact={(noteId, emoji) => dispatch({ type: "note_reacted", noteId, emoji })}
              onRead={() => dispatch({ type: "thread_read", postId: notesPost.id })}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}

