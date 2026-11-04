"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { MotionConfig, useReducedMotion } from "framer-motion"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { OverviewRail } from "@/components/agentic/interface/overview-rail"
import type { WithId } from "@/lib/firebase/serialize"
import type { Post } from "@/lib/schemas"
import { deriveChip, deriveRail } from "@/components/agentic/engine/reducer"
import { EngineProvider, useEngine } from "@/components/agentic/engine/engine-context"
import { EngineBridge } from "@/components/agentic/engine/use-engine-bridge"
import { usePersist } from "@/components/agentic/engine/persist"
import { HandoffProvider, useHandoff } from "@/components/agentic/handoff/handoff-context"
import { usePrototypeShortcuts } from "@/components/agentic/use-shortcuts"
import { Flyout } from "@/components/agentic/interface/flyout"
import { OrbDock } from "@/components/agentic/interface/orb-dock"
import { useOrbDrag } from "@/components/agentic/interface/use-orb-drag"
import { REDUCED_POPUP, TOAST_UNDO_MS, tw } from "@/components/agentic/lib"
import { LiveAnnouncerProvider, LiveRegions, useAnnounce } from "@/components/agentic/live-announcer"
import { Composer } from "@/components/agentic/primitives/composer"
import { micReducer } from "@/components/agentic/primitives/mic-machine"
import { deriveOrbState } from "@/components/agentic/primitives/orb-machine"
import { AssistantAvatar } from "@/components/agentic/primitives/presence-orb"
import { PrototypeProvider, useAgenticMotion, usePrototype } from "@/components/agentic/prototype-context"
import type { CalendarFilter, EngineEffect, EngineEvent, MicState, PresencePrefs, TeamMember, ViewState } from "@/components/agentic/types"
import { ActivitySurface } from "@/components/agentic/overlays/activity-surface"
import { usePendingApprovals, useSavePersona } from "@/components/agentic/overlays/pending-approvals"
import { PersonaPresenceSheet } from "@/components/agentic/overlays/persona-presence-sheet"
import { ContributorApproval } from "@/components/agentic/collab/contributor-approval"
import { NoteThread } from "@/components/agentic/collab/note-thread"
import { TimblModeView } from "@/components/agentic/views/timbl-mode-view"
import { MobileView } from "@/components/agentic/views/mobile-view"
import { TalkSheet } from "@/components/agentic/mobile/talk-sheet"
import { HandoffTransition } from "@/components/agentic/handoff/handoff-transition"
import { applySpokenTool, useLiveSession } from "@/components/agentic/voice/use-live-session"
import { useScriptedUtterance } from "@/components/agentic/voice/scripted"

function useRail(weekStart: string) {
  const { viewer } = usePrototype()
  const { state, env } = useEngine()
  return deriveRail(state, viewer, weekStart, env)
}

function OrbLayer({ onOpenOverview, weekStart }: { onOpenOverview?: () => void; weekStart: string }) {
  const { copy, view, update, dismiss, prefs } = usePrototype()
  const { state, dispatch } = useEngine()
  const { orbRef, triggerIn } = useHandoff()
  const rail = useRail(weekStart)
  const boundsRef = useRef<HTMLDivElement | null>(null)
  const dockRef = useRef<HTMLDivElement | null>(null)
  const drag = useOrbDrag("calendar", boundsRef, dockRef)
  const [miniText, setMiniText] = useState("")
  const [miniMic, setMiniMic] = useState<MicState>("idle")
  const [narrow, setNarrow] = useState(false)
  const onMiniMic = (event: Parameters<typeof micReducer>[1]) =>
    setMiniMic((current) => {
      const next = micReducer(current, event, false)
      return next === "transcribing" ? "idle" : next
    })

  useEffect(() => {
    if (miniMic !== "listening" && miniMic !== "requesting") return
    const id = window.setTimeout(() => setMiniMic("idle"), 20_000)
    return () => window.clearTimeout(id)
  }, [miniMic])

  useEffect(() => {
    const el = boundsRef.current
    const apply = (width: number) => setNarrow(width < 768)
    if (el) apply(el.clientWidth)
    const ro = el && typeof ResizeObserver !== "undefined" ? new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) apply(width)
    }) : null
    if (el && ro) ro.observe(el)
    const open = () => update({ view: "timbl", sheet: null }, "push")
    const ask = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string }>).detail
      if (!detail?.id) return
      dispatch({ type: "context_set", context: { kind: "post", postId: detail.id } })
      update({ sheet: "flyout", post: detail.id }, "push")
    }
    window.addEventListener("timbl:open", open)
    window.addEventListener("timbl:ask", ask)
    return () => {
      ro?.disconnect()
      window.removeEventListener("timbl:open", open)
      window.removeEventListener("timbl:ask", ask)
    }
  }, [dispatch, update])

  useEffect(() => {
    if (state.context.kind === "none" && weekStart) dispatch({ type: "context_set", context: { kind: "calendar", week: weekStart } })
  }, [dispatch, state.context.kind, weekStart])

  const chip = deriveChip(state, copy)
  const pendingCount = state.requests.filter((request) => request.status === "pending").length
  const orbState = deriveOrbState({
    forced: null,
    mic: miniMic,
    run: state.run,
    pendingRequests: pendingCount + rail.attention.length,
    lastEventKind: state.lastEventKind,
  })
  const flyoutStatus =
    orbState === "working" && state.run
      ? copy.flyout.statusWorking(Math.max(1, state.run.steps.findIndex((step) => step.state === "running") + 1), state.run.steps.length)
      : orbState === "needs_you"
        ? copy.flyout.statusNeedsYou
        : orbState === "error"
          ? copy.flyout.statusError
          : orbState === "done"
            ? copy.flyout.statusDone
            : copy.flyout.statusIdle
  const contextPost =
    (state.context.kind === "post" ? state.posts[state.context.postId] : undefined) ?? (view.post ? state.posts[view.post] : undefined)
  const contextTitle = contextPost ? contextPost.brief || contextPost.blurb || "" : ""
  const flyoutContext = contextPost ? { label: copy.flyout.contextLabel, value: contextTitle } : null

  const openTimbl = (carry: "chat" | "chat_and_item" | "none") => {
    const chipText =
      carry === "chat_and_item" && contextPost
        ? copy.flyout.carryItem(contextTitle, state.miniChat.length)
        : carry === "chat"
          ? copy.flyout.carryChat(state.miniChat.length)
          : null
    triggerIn({
      carryText: chipText,
      onSwap: () => {
        dispatch({ type: "handoff_in", carry })
        update({ view: "timbl", sheet: null }, "push")
      },
    })
  }

  return (
    <div ref={boundsRef} className="pointer-events-none absolute inset-0 z-30">
      {view.view === "timbl" ? (
        <div className="pointer-events-auto absolute inset-0 z-40 flex min-h-0 bg-background">
          <TimblModeView chrome="desktop" attention={rail.attention.length} />
        </div>
      ) : view.view === "mobile" ? (
        <div className="pointer-events-auto absolute inset-0 z-40 flex min-h-0 bg-background">
          <MobileView />
        </div>
      ) : (
        <div
          ref={dockRef}
          data-slot="agentic-orb-anchor"
          onPointerDown={drag.onPointerDown}
          onPointerMove={drag.onPointerMove}
          onPointerUp={drag.onPointerUp}
          onPointerCancel={drag.onPointerUp}
          onClickCapture={drag.onClickCapture}
          className={tw(
            "pointer-events-auto absolute z-30 cursor-grab touch-none select-none active:cursor-grabbing",
            drag.point ? undefined : "right-4 bottom-4",
          )}
          style={drag.point ? { left: drag.point.x, top: drag.point.y } : undefined}
        >
          <Flyout
            open={view.sheet === "flyout"}
            onOpenChange={(next, details) => {
              if (!next && details?.reason === "outside-press") {
                details.cancel()
                return
              }
              if (next) update({ sheet: "flyout" }, "push")
              else dismiss({ sheet: null })
            }}
            layout={narrow ? "sheet" : "popover"}
            status={flyoutStatus}
            context={flyoutContext}
            entries={state.miniChat}
            assistantAvatar={<AssistantAvatar />}
            handoffDisabled={!contextPost}
            density={narrow ? "touch" : "pointer"}
            onFull={() => openTimbl("chat")}
            onHandoff={() => openTimbl("chat_and_item")}
            onNewChat={() => dispatch({ type: "new_mini_chat" })}
            onOpenOverview={onOpenOverview}
            onClose={() => dismiss({ sheet: null })}
            onOpenActivity={() => update({ sheet: "activity" }, "push")}
            composer={
              <Composer
                id="flyout-composer"
                variant="mini"
                value={miniText}
                onChange={setMiniText}
                onSend={(value) => {
                  dispatch({ type: "mini_sent", text: value })
                  setMiniText("")
                }}
                suggestions={[]}
                placeholder={copy.flyout.placeholder}
                mic={{ mode: "inline", state: miniMic, onMicEvent: onMiniMic }}
                density="pointer"
              />
            }
            trigger={
              <OrbDock
                anchorRef={orbRef}
                state={orbState}
                label={chip?.label}
                largeTarget={prefs.largerTarget}
                expanded={view.sheet === "flyout"}
                onPress={() => update({ sheet: view.sheet === "flyout" ? null : "flyout" }, "push")}
                onOpenActivity={() => update({ sheet: "activity" }, "push")}
              />
            }
          />
        </div>
      )}
    </div>
  )
}

function ProductRail({
  period,
  weekStart,
  onOpenPost,
  onCollapse,
  extras,
}: {
  period: string
  weekStart: string
  onOpenPost: (id: string) => void
  onCollapse?: () => void
  extras?: React.ReactNode
}) {
  const { copy, update } = usePrototype()
  const { dispatch } = useEngine()
  const { triggerIn } = useHandoff()
  const rail = useRail(weekStart)
  const line = { guardrail: copy.approval.meta, contributor: copy.approve.status, agent_draft: copy.cards.queue.agentRow, mention: copy.notes.mentionLine }
  return (
    <OverviewRail
      period={period}
      stats={rail.stats}
      attention={rail.attention.map((row) => ({ postId: row.postId, title: row.title, line: line[row.source], unread: row.unread }))}
      comingUp={rail.comingUp}
      onOpenTimbl={() =>
        triggerIn({
          carryText: null,
          onSwap: () => {
            dispatch({ type: "handoff_in", carry: "none" })
            update({ view: "timbl", sheet: null }, "push")
          },
        })
      }
      onOpenPost={onOpenPost}
      onSettings={() => update({ sheet: "persona" }, "push")}
      onCollapse={onCollapse}
    >
      {extras}
    </OverviewRail>
  )
}

function ShortcutOwner() {
  usePrototypeShortcuts()
  return null
}

type RuntimeProps = {
  children: React.ReactNode
  onOpenOverview?: () => void
  onMode?: (timbl: boolean) => void
  period: string
  posts: WithId<Post>[]
  campaignCount: number
  cadencePerWeek: number
  extras?: React.ReactNode
  onOpenPost: (post: WithId<Post>) => void
  overviewCollapsed: boolean
  onCollapseOverview: () => void
  sheetOpen: boolean
  onSheetOpenChange: (open: boolean) => void
  weekStart: string
  filter: CalendarFilter
  events: { name: string; date: string }[]
  onWeek?: (week: string) => void
}

function OrbRuntime({
  children,
  onOpenOverview,
  onMode,
  period,
  posts,
  campaignCount,
  cadencePerWeek,
  extras,
  onOpenPost,
  overviewCollapsed,
  onCollapseOverview,
  sheetOpen,
  onSheetOpenChange,
  weekStart,
  filter,
  events,
  onWeek,
}: RuntimeProps) {
  const { view, update, prefs, copy } = usePrototype()
  const osReduced = useReducedMotion()
  const announce = useAnnounce()
  const persist = usePersist(useCallback((message: string) => toast.error(message), []))
  useEffect(() => {
    if (view.filter !== filter || view.week !== weekStart) update({ week: weekStart, filter })
  }, [filter, update, view.filter, view.week, weekStart])
  const overlay = view.view === "timbl" || view.view === "mobile"
  useEffect(() => {
    onMode?.(view.view === "timbl")
    if (overlay) onSheetOpenChange(false)
  }, [onMode, onSheetOpenChange, overlay, view.view])
  const openPost = (id: string) => {
    const post = posts.find((item) => item.id === id)
    if (post) onOpenPost(post)
  }
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
      else if (effect.type === "navigate") {
        update({ view: effect.view, ...(effect.week ? { week: effect.week } : {}), ...(effect.post ? { post: effect.post } : {}), sheet: null }, "push")
        if (effect.week) onWeek?.(effect.week)
        if (effect.view === "interface" && effect.post) {
          window.setTimeout(() => document.querySelector<HTMLElement>(`[data-post-id="${effect.post}"]`)?.focus(), 80)
        }
      } else if (effect.type === "open_sheet") update({ sheet: effect.sheet, ...(effect.post ? { post: effect.post } : {}) }, "push")
      else if (effect.type === "canvas_shown") update({ canvas: "shown" })
      else if (effect.type === "scroll_to") {
        document.querySelector<HTMLElement>("[data-slot=agentic-approval-card]")?.scrollIntoView({ block: "nearest" })
      } else if (effect.type === "focus_composer") {
        window.setTimeout(() => document.querySelector<HTMLTextAreaElement>("#timbl-composer, [data-slot=agentic-flyout-panel] textarea")?.focus(), 40)
      }
    },
    [announce, copy.approval.undoInline, onWeek, persist, update],
  )
  const rail = (collapse?: () => void) => (
    <ProductRail period={period} weekStart={weekStart} extras={extras} onOpenPost={openPost} onCollapse={collapse} />
  )
  return (
    <MotionConfig reducedMotion={prefs.reduceMotion ? "always" : "user"}>
      <EngineProvider cadence={cadencePerWeek} campaigns={campaignCount} onEffect={onEffect}>
        <EngineBridge posts={posts} events={events} />
        <HandoffProvider>
          <ShortcutOwner />
          <HandoffTransition />
          <div
            data-slot="agentic-root"
            data-reduced-motion={prefs.reduceMotion || osReduced ? "" : undefined}
            className="relative flex min-h-0 flex-1 overflow-hidden"
          >
            <LiveRegions />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col" aria-hidden={overlay || undefined} inert={overlay || undefined}>
              {children}
            </div>
            {!overlay && !overviewCollapsed ? <div className="hidden min-h-0 @7xl/iface:flex">{rail(onCollapseOverview)}</div> : null}
            <OrbLayer onOpenOverview={onOpenOverview} weekStart={weekStart} />
          </div>
          <Sheet open={sheetOpen && !overlay} onOpenChange={onSheetOpenChange}>
            <SheetContent side="right" className="w-80 max-w-full p-0 @7xl/iface:hidden">
              <SheetHeader className="sr-only">
                <SheetTitle>{copy.iface.rail.title}</SheetTitle>
              </SheetHeader>
              {rail()}
            </SheetContent>
          </Sheet>
          <OrbSheets />
        </HandoffProvider>
      </EngineProvider>
    </MotionConfig>
  )
}

function OrbSheets() {
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

export function CalendarOrb({
  children,
  team,
  workspaceName,
  assistantName,
  prefs,
  awarenessDays = [],
  viewerId,
  initialView,
  ...runtime
}: Omit<RuntimeProps, "events"> & {
  team: TeamMember[]
  workspaceName: string
  assistantName: string
  prefs: PresencePrefs
  awarenessDays?: { name: string; date: string }[]
  viewerId: string
  initialView: ViewState
}) {
  const viewer = team.find((member) => member.id === viewerId) ?? team[0]
  return (
    <PrototypeProvider
      initialView={{ ...initialView, week: runtime.weekStart, filter: runtime.filter }}
      viewer={viewer}
      team={team}
      workspaceName={workspaceName}
      assistantName={assistantName}
      prefs={prefs}
    >
      <LiveAnnouncerProvider>
        <OrbRuntime {...runtime} events={awarenessDays}>
          {children}
        </OrbRuntime>
      </LiveAnnouncerProvider>
    </PrototypeProvider>
  )
}
