"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { format, parseISO } from "date-fns"
import { MotionConfig } from "framer-motion"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { OverviewRail } from "@/components/agentic/interface/overview-rail"
import type { WithId } from "@/lib/firebase/serialize"
import type { Post } from "@/lib/schemas"
import { deriveChip } from "@/components/agentic/engine/reducer"
import { EngineProvider, useEngine } from "@/components/agentic/engine/engine-context"
import { EngineBridge } from "@/components/agentic/engine/use-engine-bridge"
import { HandoffProvider, useHandoff } from "@/components/agentic/handoff/handoff-context"
import { usePrototypeShortcuts } from "@/components/agentic/use-shortcuts"
import { Flyout } from "@/components/agentic/interface/flyout"
import { OrbDock } from "@/components/agentic/interface/orb-dock"
import { useOrbDrag } from "@/components/agentic/interface/use-orb-drag"
import { REDUCED_POPUP, TOAST_UNDO_MS, tw } from "@/components/agentic/lib"
import { LiveAnnouncerProvider, useAnnounce } from "@/components/agentic/live-announcer"
import { Composer } from "@/components/agentic/primitives/composer"
import { micReducer } from "@/components/agentic/primitives/mic-machine"
import { deriveOrbState } from "@/components/agentic/primitives/orb-machine"
import { AssistantAvatar } from "@/components/agentic/primitives/presence-orb"
import { PrototypeProvider, usePrototype } from "@/components/agentic/prototype-context"
import type { EngineEffect, MicState, TeamMember } from "@/components/agentic/types"
import { DEFAULT_VIEW } from "@/components/agentic/view-state"
import { ActivitySurface } from "@/components/agentic/overlays/activity-surface"
import { PersonaPresenceSheet } from "@/components/agentic/overlays/persona-presence-sheet"
import { ContributorApproval } from "@/components/agentic/collab/contributor-approval"
import { NoteThread } from "@/components/agentic/collab/note-thread"
import { ApprovalCard } from "@/components/agentic/primitives/approval-card"
import { TimblModeView } from "@/components/agentic/views/timbl-mode-view"
import { MobileView } from "@/components/agentic/views/mobile-view"
import { TalkSheet } from "@/components/agentic/mobile/talk-sheet"
import { HandoffTransition } from "@/components/agentic/handoff/handoff-transition"
import { savePersona } from "@/lib/actions/persona"
import { useLiveSession } from "@/components/agentic/voice/use-live-session"
import type { CalendarFilter, PresencePrefs } from "@/components/agentic/types"

function OrbLayer({
  onOpenOverview,
  attention,
}: {
  onOpenOverview?: () => void
  attention: number
}) {
  const { copy, view, update, dismiss, prefs } = usePrototype()
  const { state, dispatch } = useEngine()
  const { orbRef, triggerIn } = useHandoff()
  const boundsRef = useRef<HTMLDivElement | null>(null)
  const dockRef = useRef<HTMLDivElement | null>(null)
  const drag = useOrbDrag("calendar", boundsRef, dockRef)
  const [miniText, setMiniText] = useState("")
  const [miniMic, setMiniMic] = useState<MicState>("idle")
  const [narrow, setNarrow] = useState(false)
  const [asked, setAsked] = useState<{ id: string; title: string } | null>(null)
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
    const open = () => {
      update({ view: "timbl", sheet: null }, "push")
    }
    const ask = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; title: string }>).detail
      if (!detail?.id || !detail.title) return
      setAsked(detail)
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

  const chip = deriveChip(state, copy)
  const pendingCount = state.requests.filter((request) => request.status === "pending").length
  const orbState = deriveOrbState({
    forced: view.orb,
    mic: miniMic,
    run: state.run,
    pendingRequests: pendingCount + attention,
    lastEventKind: state.lastEventKind,
  })
  const flyoutStatus =
    orbState === "working" && state.run
      ? copy.flyout.statusWorking(
          Math.max(1, state.run.steps.findIndex((step) => step.state === "running") + 1),
          state.run.steps.length,
        )
      : orbState === "needs_you"
        ? copy.flyout.statusNeedsYou
        : orbState === "error"
          ? copy.flyout.statusError
          : orbState === "done"
            ? copy.flyout.statusDone
            : copy.flyout.statusIdle
  const contextPost =
    (state.context.kind === "post" ? state.posts[state.context.postId] : undefined) ??
    (view.post ? state.posts[view.post] : undefined)
  const flyoutContext = asked
    ? { label: copy.flyout.contextLabel, value: asked.title }
    : contextPost
      ? { label: copy.flyout.contextLabel, value: contextPost.brief ?? "Untitled post" }
      : null

  const openTimbl = (carry: "chat" | "chat_and_item" | "none") => {
    const chipText =
      carry === "chat_and_item" && contextPost
        ? copy.flyout.carryItem(contextPost.brief ?? "Untitled post", state.miniChat.length)
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
          <TimblModeView chrome="desktop" attention={attention} />
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
                mic={{
                  mode: "inline",
                  state: miniMic,
                  onMicEvent: onMiniMic,
                }}
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
  posts,
  campaignCount,
  cadencePerWeek,
  onOpenPost,
  onCollapse,
  extras,
}: {
  period: string
  posts: WithId<Post>[]
  campaignCount: number
  cadencePerWeek: number
  onOpenPost: (post: WithId<Post>) => void
  onCollapse?: () => void
  extras?: React.ReactNode
}) {
  const { copy, update } = usePrototype()
  const { dispatch } = useEngine()
  const { triggerIn } = useHandoff()
  const today = format(new Date(), "yyyy-MM-dd")
  const attention = posts.filter((post) => post.agentMeta?.reviewState === "pending" || post.status === "review")
  const coming = [...posts]
    .filter((post) => post.scheduledDate >= today)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? ""))
    .slice(0, 6)
  const scheduled = posts.filter((post) => post.status === "scheduled").length
  const openTimbl = () => {
    triggerIn({
      carryText: null,
      onSwap: () => {
        dispatch({ type: "handoff_in", carry: "none" })
        update({ view: "timbl", sheet: null }, "push")
      },
    })
  }
  return (
    <OverviewRail
      period={period}
      stats={{
        scheduled,
        review: attention.length,
        slots: Math.max(0, cadencePerWeek - posts.filter((post) => post.status !== "archived").length),
        campaigns: campaignCount,
      }}
      attention={attention.map((post) => ({
        postId: post.id,
        title: post.brief || post.blurb || "Untitled post",
        line: copy.approval.meta,
        unread: { count: 0, mentions: 0 },
      }))}
      comingUp={coming.map((post) => ({
        postId: post.id,
        title: post.brief || post.blurb || "Untitled post",
        when: `${format(parseISO(post.scheduledDate), "EEE d MMM")}${post.scheduledTime ? `, ${post.scheduledTime}` : ""}`,
      }))}
      onOpenTimbl={openTimbl}
      onOpenPost={(id) => {
        const post = posts.find((item) => item.id === id)
        if (post) onOpenPost(post)
      }}
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
}: {
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
}) {
  const { view, update } = usePrototype()
  useEffect(() => {
    if (view.filter !== filter) update({ filter })
    if (view.week === weekStart) return
    if (view.week && weekStart && view.week.slice(0, 7) === weekStart.slice(0, 7)) return
    update({ week: weekStart, filter })
  }, [filter, update, view.filter, view.week, weekStart])
  const overlay = view.view === "timbl" || view.view === "mobile"
  useEffect(() => {
    onMode?.(view.view === "timbl")
    if (overlay) onSheetOpenChange(false)
  }, [onMode, onSheetOpenChange, overlay, view.view])
  const announce = useAnnounce()
  const undoDispatchRef = useRef<((event: NonNullable<Extract<EngineEffect, { type: "toast" }>["undo"]>) => void) | null>(null)
  const onEffect = useCallback(
    (effect: EngineEffect) => {
      if (!effect?.type) return
      if (effect.type === "toast") {
        const undoEvent = effect.undo
        toast(effect.message, {
          duration: undoEvent ? TOAST_UNDO_MS : 4000,
          action: undoEvent ? { label: "Undo", onClick: () => undoDispatchRef.current?.(undoEvent) } : undefined,
        })
      } else if (effect.type === "announce") {
        announce(effect.message)
      } else if (effect.type === "navigate") {
        update(
          {
            view: effect.view,
            ...(effect.week ? { week: effect.week } : {}),
            ...(effect.post ? { post: effect.post } : {}),
            sheet: null,
          },
          "push",
        )
        if (effect.week) onWeek?.(effect.week)
        if (effect.view === "interface" && effect.post) {
          window.setTimeout(() => {
            document.querySelector<HTMLElement>(`[data-post-id="${effect.post}"]`)?.focus()
          }, 50)
        }
      } else if (effect.type === "open_sheet") {
        update({ sheet: effect.sheet, ...(effect.post ? { post: effect.post } : {}) }, "push")
      } else if (effect.type === "canvas_shown") {
        update({ canvas: "shown" })
      }
    },
    [announce, onWeek, update],
  )
  const reduced = view.motion === "reduced"
  const rail = (
    <ProductRail
      period={period}
      posts={posts}
      campaignCount={campaignCount}
      cadencePerWeek={cadencePerWeek}
      extras={extras}
      onOpenPost={onOpenPost}
      onCollapse={onCollapseOverview}
    />
  )
  return (
    <MotionConfig reducedMotion={reduced ? "always" : "user"}>
      <EngineProvider onEffect={onEffect}>
        <EngineBridge posts={posts} events={events} />
        <HandoffProvider>
          <ShortcutOwner />
          <HandoffTransition />
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            <div
              className="flex min-h-0 min-w-0 flex-1 flex-col"
              aria-hidden={overlay || undefined}
              inert={overlay || undefined}
            >
              {children}
            </div>
            {!overlay && !overviewCollapsed ? <div className="hidden min-h-0 @7xl/iface:flex">{rail}</div> : null}
            <OrbLayer
              onOpenOverview={onOpenOverview}
              attention={posts.filter((post) => post.agentMeta?.reviewState === "pending" || post.status === "review").length}
            />
          </div>
          <Sheet open={sheetOpen && !overlay} onOpenChange={onSheetOpenChange}>
            <SheetContent side="right" className="w-80 max-w-[85vw] p-0 @7xl/iface:hidden">
              <SheetHeader className="sr-only">
                <SheetTitle>Overview</SheetTitle>
              </SheetHeader>
              <ProductRail
                period={period}
                posts={posts}
                campaignCount={campaignCount}
                cadencePerWeek={cadencePerWeek}
                extras={extras}
                onOpenPost={onOpenPost}
              />
            </SheetContent>
          </Sheet>
          <OrbSheets />
        </HandoffProvider>
      </EngineProvider>
    </MotionConfig>
  )
}

function OrbSheets() {
  const { view, dismiss, prefs, setPrefs, assistantName, setAssistantName, role, copy, team, viewer } = usePrototype()
  const { state, dispatch } = useEngine()
  const [tab, setTab] = useState<"needs" | "log">("needs")
  const voice = useLiveSession()
  const notesPost = (view.post ? state.posts[view.post] : undefined) ?? Object.values(state.posts)[0]
  const notesSubmission = notesPost ? state.submissions.find((item) => item.postId === notesPost.id) ?? null : null
  const notesList = notesPost ? state.notes.filter((note) => note.postId === notesPost.id) : []
  const notesLastRead = notesPost
    ? state.reads.find((read) => read.postId === notesPost.id && read.userId === viewer.id)?.lastReadAt
    : undefined
  const needs = state.requests
    .filter((request) => request.status === "pending")
    .map((request) => (
      <ApprovalCard
        key={request.id}
        compact
        request={request}
        posts={request.postIds.map((id) => state.posts[id]).filter((post) => Boolean(post))}
        viewerRole={role}
        onApprove={() => dispatch({ type: "request_resolved", requestId: request.id, outcome: "approved" })}
        onRequestChanges={(feedback) =>
          dispatch({ type: "request_resolved", requestId: request.id, outcome: "changes_requested", feedback })
        }
        onSubmit={() => dispatch({ type: "request_resolved", requestId: request.id, outcome: "approved" })}
      />
    ))
  return (
    <>
      <ActivitySurface
        open={view.sheet === "activity"}
        onOpenChange={(open) => !open && dismiss({ sheet: null })}
        layout="side"
        finalFocus={() => document.querySelector<HTMLElement>("h1")}
        reduced={view.motion === "reduced"}
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
        finalFocus={() => document.querySelector<HTMLElement>("h1")}
        reduced={view.motion === "reduced"}
        role={role}
        assistantName={assistantName}
        prefs={prefs}
        inFrame={false}
        onSave={async (name, nextPrefs) => {
          const result = await savePersona({
            assistantName: name,
            reduceMotion: nextPrefs.reduceMotion,
            largerTarget: nextPrefs.largerTarget,
            tips: nextPrefs.tips,
            voiceLocale: nextPrefs.voiceLocale,
            personality: nextPrefs.personality,
            workingStyle: nextPrefs.workingStyle,
            showCursors: Boolean(nextPrefs.showCursors),
            shortcuts: nextPrefs.shortcuts,
            ambient: nextPrefs.ambient,
          })
          if (!result.ok) {
            toast.error(result.error ?? copy.persona.saved)
            return
          }
          setAssistantName(name)
          setPrefs(nextPrefs)
          toast(copy.persona.saved)
          dismiss({ sheet: null })
        }}
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
        onOrb={() => {
          if (voice.talkState === "listening") {
            const text = voice.consume()
            void voice.close()
            if (text) dispatch({ type: "user_sent", text, source: "voice" })
          } else {
            void voice.startTalk()
          }
        }}
        onHoldStart={() => {
          void voice.startTalk()
        }}
        onHoldEnd={() => {
          const text = voice.consume()
          void voice.close()
          if (text) dispatch({ type: "user_sent", text, source: "voice" })
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
          dismiss({ sheet: null })
        }}
        onRetry={() => void voice.startTalk()}
      />
      <Sheet open={view.sheet === "notes"} onOpenChange={(open) => !open && dismiss({ sheet: null })}>
        <SheetContent
          side="right"
          finalFocus={() =>
            document.querySelector<HTMLElement>(`[data-post-id="${view.post ?? ""}"]`) ??
            document.querySelector<HTMLElement>("h1")
          }
          className={tw("flex flex-col gap-4 overflow-y-auto p-5", view.motion === "reduced" && REDUCED_POPUP)}
        >
          <SheetHeader className="p-0">
            <SheetTitle>
              <span className="text-title-md text-foreground">
                {copy.iface.calendar.notesTitle(notesPost?.brief ?? "post")}
              </span>
            </SheetTitle>
          </SheetHeader>
          {notesPost && notesSubmission ? (
            <ContributorApproval
              post={notesPost}
              submission={notesSubmission}
              viewer={viewer}
              team={team}
              onApprove={() => dispatch({ type: "submission_decided", postId: notesPost.id, outcome: "approved" })}
              onSendBack={(reason, note) =>
                dispatch({ type: "submission_decided", postId: notesPost.id, outcome: "sent_back", reason, note })
              }
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
  onOpenOverview,
  onMode,
  period,
  posts,
  campaignCount,
  cadencePerWeek,
  extras,
  team,
  workspaceName,
  onOpenPost,
  overviewCollapsed,
  onCollapseOverview,
  sheetOpen,
  onSheetOpenChange,
  weekStart,
  filter,
  assistantName,
  prefs,
  awarenessDays = [],
  onWeek,
}: {
  children: React.ReactNode
  onOpenOverview?: () => void
  onMode?: (timbl: boolean) => void
  period: string
  posts: WithId<Post>[]
  campaignCount: number
  cadencePerWeek: number
  extras?: React.ReactNode
  team: TeamMember[]
  workspaceName: string
  onOpenPost: (post: WithId<Post>) => void
  overviewCollapsed: boolean
  onCollapseOverview: () => void
  sheetOpen: boolean
  onSheetOpenChange: (open: boolean) => void
  weekStart: string
  filter: CalendarFilter
  assistantName: string
  prefs: PresencePrefs
  awarenessDays?: { name: string; date: string }[]
  onWeek?: (week: string) => void
}) {
  const viewer = team[0]
  return (
    <PrototypeProvider
      syncUrl
      initialView={{ ...DEFAULT_VIEW, toolbar: false, week: weekStart, filter }}
      viewer={viewer}
      team={team}
      workspaceName={workspaceName}
      assistantName={assistantName}
      prefs={prefs}
    >
      <LiveAnnouncerProvider>
        <OrbRuntime
          onOpenOverview={onOpenOverview}
          onMode={onMode}
          period={period}
          posts={posts}
          campaignCount={campaignCount}
          cadencePerWeek={cadencePerWeek}
          extras={extras}
          onOpenPost={onOpenPost}
          overviewCollapsed={overviewCollapsed}
          onCollapseOverview={onCollapseOverview}
          sheetOpen={sheetOpen}
          onSheetOpenChange={onSheetOpenChange}
          weekStart={weekStart}
          filter={filter}
          events={awarenessDays}
          onWeek={onWeek}
        >
          {children}
        </OrbRuntime>
      </LiveAnnouncerProvider>
    </PrototypeProvider>
  )
}
