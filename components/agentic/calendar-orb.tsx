"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { OverviewRail } from "@/components/agentic/interface/overview-rail"
import type { WithId } from "@/lib/firebase/serialize"
import type { Post } from "@/lib/schemas"
import { deriveChip, deriveRail } from "@/components/agentic/engine/reducer"
import { useEngine } from "@/components/agentic/engine/engine-context"
import { asPrototypePost } from "@/components/agentic/engine/use-engine-bridge"
import { fetchPostAction } from "@/lib/actions/posts"
import { useHandoff } from "@/components/agentic/handoff/handoff-context"
import { usePrototypeShortcuts } from "@/components/agentic/use-shortcuts"
import { Flyout } from "@/components/agentic/interface/flyout"
import { OrbDock } from "@/components/agentic/interface/orb-dock"
import { useOrbDrag } from "@/components/agentic/interface/use-orb-drag"
import { tw } from "@/components/agentic/lib"
import { LiveRegions } from "@/components/agentic/live-announcer"
import { Composer } from "@/components/agentic/primitives/composer"
import type { MicEvent } from "@/components/agentic/primitives/mic-machine"
import { deriveOrbState } from "@/components/agentic/primitives/orb-machine"
import { AssistantAvatar } from "@/components/agentic/primitives/presence-orb"
import { usePrototype } from "@/components/agentic/prototype-context"
import type { CalendarFilter, MicState, PresencePrefs, TeamMember, ViewState } from "@/components/agentic/types"
import { TimblModeView } from "@/components/agentic/views/timbl-mode-view"
import { MobileView } from "@/components/agentic/views/mobile-view"
import { useLiveSession } from "@/components/agentic/voice/use-live-session"
import { AgenticProviders, AgenticRuntime, useReducedMotionAttr, type NavigateEffect } from "@/components/agentic/agentic-runtime"

function useRail(weekStart: string) {
  const { viewer } = usePrototype()
  const { state, env } = useEngine()
  return deriveRail(state, viewer, weekStart, env)
}

function OrbLayer({ onOpenOverview, weekStart, surfaceContext }: { onOpenOverview?: () => void; weekStart: string; surfaceContext: string }) {
  const { copy, view, update, dismiss, prefs } = usePrototype()
  const { state, dispatch } = useEngine()
  const voice = useLiveSession({ instruction: copy.prompts.liveSystem })
  const { orbRef, triggerIn } = useHandoff()
  const rail = useRail(weekStart)
  const boundsRef = useRef<HTMLDivElement | null>(null)
  const dockRef = useRef<HTMLDivElement | null>(null)
  const drag = useOrbDrag("calendar", boundsRef, dockRef)
  const [miniText, setMiniText] = useState("")
  const [miniSource, setMiniSource] = useState<"typed" | "voice">("typed")
  const [narrow, setNarrow] = useState(false)
  const lastSurface = useRef(surfaceContext)
  const miniMic: MicState =
    voice.talkState === "requesting" ? "requesting" :
    voice.talkState === "listening" ? "listening" :
    voice.talkState === "denied" ? "denied" :
    voice.error ? "error" : "idle"
  const finishDictation = async () => {
    await voice.close()
    const text = voice.consume()
    if (text) {
      setMiniText((current) => `${current}${current ? " " : ""}${text}`)
      setMiniSource("voice")
    }
  }
  const onMiniMic = (event: MicEvent) => {
    if (event.type === "press") {
      if (voice.talkState === "listening") void finishDictation()
      else void voice.startDictate()
    } else if (event.type === "hold_start") {
      void voice.startDictate()
    } else if (event.type === "hold_end" || event.type === "endpoint") {
      void finishDictation()
    } else if (event.type === "cancel" || (event.type === "permission" && !event.granted)) {
      void voice.close()
    } else if (event.type === "permission" && event.granted) {
      void voice.startDictate()
    }
  }

  useEffect(() => {
    const el = boundsRef.current
    const apply = (width: number) => setNarrow(width < 768)
    if (el) apply(el.clientWidth)
    const ro = el && typeof ResizeObserver !== "undefined" ? new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) apply(width)
    }) : null
    if (el && ro) ro.observe(el)
    const open = () => update({ sheet: "flyout" }, "push")
    const ask = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string }>).detail
      if (!detail?.id) return
      dispatch({ type: "context_set", context: { kind: "post", postId: detail.id } })
      update({ sheet: "flyout", post: detail.id }, "push")
    }
    window.addEventListener("timbl:open", open)
    window.addEventListener("timbl:ask", ask)
    const setContextFromPost = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element) || target.closest("[data-slot^='agentic-']")) return
      const postId = target.closest<HTMLElement>("[data-post-id]")?.dataset.postId
      if (!postId) return
      if (state.posts[postId]) {
        dispatch({ type: "context_set", context: { kind: "post", postId } })
        return
      }
      void fetchPostAction(postId).then((post) => {
        if (!post) return
        dispatch({ type: "hydrate_posts", posts: { [post.id]: asPrototypePost(post) } })
        dispatch({ type: "context_set", context: { kind: "post", postId } })
      })
    }
    document.addEventListener("click", setContextFromPost, true)
    return () => {
      ro?.disconnect()
      window.removeEventListener("timbl:open", open)
      window.removeEventListener("timbl:ask", ask)
      document.removeEventListener("click", setContextFromPost, true)
    }
  }, [dispatch, state.posts, update])

  useEffect(() => {
    if (surfaceContext === "Calendar" && state.context.kind === "none" && weekStart) dispatch({ type: "context_set", context: { kind: "calendar", week: weekStart } })
  }, [dispatch, state.context.kind, surfaceContext, weekStart])

  useEffect(() => {
    if (lastSurface.current === surfaceContext) return
    lastSurface.current = surfaceContext
    dispatch({ type: "context_set", context: { kind: "none" } })
  }, [dispatch, surfaceContext])

  useEffect(() => {
    if (surfaceContext === "Calendar") return
    const targets = ["app-shell-navigation", "app-shell-page"]
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element instanceof HTMLElement)
    for (const target of targets) {
      const hidden = view.view === "timbl" || view.view === "mobile"
      target.inert = hidden
      if (hidden) target.setAttribute("aria-hidden", "true")
      else target.removeAttribute("aria-hidden")
    }
    return () => {
      for (const target of targets) {
        target.inert = false
        target.removeAttribute("aria-hidden")
      }
    }
  }, [surfaceContext, view.view])

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
                onChange={(value) => {
                  setMiniText(value)
                  setMiniSource("typed")
                }}
                onSend={(value) => {
                  dispatch({ type: "user_sent", text: value, source: miniSource })
                  setMiniText("")
                  setMiniSource("typed")
                  update({ view: "timbl", sheet: null }, "push")
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
  onClose,
  density,
  categoryFilter,
  categorySummary,
}: {
  period: string
  weekStart: string
  onOpenPost: (id: string) => void
  onCollapse?: () => void
  onClose?: () => void
  density?: "touch" | "pointer"
  categoryFilter?: React.ReactNode
  categorySummary?: string | null
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
      categoryFilter={categoryFilter}
      categorySummary={categorySummary === undefined ? copy.iface.rail.categorySummary : categorySummary}
      density={density}
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
      onOpenActivity={() => update({ sheet: "activity" }, "push")}
      onSettings={() => update({ sheet: "persona" }, "push")}
      onClose={onClose}
      onCollapse={onCollapse}
    />
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
  categoryFilter?: React.ReactNode
  categorySummary?: string | null
  onOpenPost: (post: WithId<Post>) => void
  overviewCollapsed: boolean
  onCollapseOverview: () => void
  sheetOpen: boolean
  onSheetOpenChange: (open: boolean) => void
  weekStart: string
  filter: CalendarFilter
  events: { name: string; date: string }[]
  onWeek?: (week: string) => void
  surfaceContext?: string
}

function OrbRuntime({
  children,
  onOpenOverview,
  onMode,
  period,
  posts,
  campaignCount,
  cadencePerWeek,
  categoryFilter,
  categorySummary,
  onOpenPost,
  overviewCollapsed,
  onCollapseOverview,
  sheetOpen,
  onSheetOpenChange,
  weekStart,
  filter,
  events,
  onWeek,
  surfaceContext = "Calendar",
}: RuntimeProps) {
  const { view, update, copy } = usePrototype()
  const reducedAttr = useReducedMotionAttr()
  useEffect(() => {
    if (surfaceContext === "Calendar" && (view.filter !== filter || view.week !== weekStart)) update({ week: weekStart, filter })
  }, [filter, surfaceContext, update, view.filter, view.week, weekStart])
  const overlay = view.view === "timbl" || view.view === "mobile"
  useEffect(() => {
    onMode?.(view.view === "timbl")
    if (overlay) onSheetOpenChange(false)
  }, [onMode, onSheetOpenChange, overlay, view.view])
  const openPost = (id: string) => {
    const post = posts.find((item) => item.id === id)
    if (post) onOpenPost(post)
  }
  const onNavigate = useCallback(
    (effect: NavigateEffect) => {
      update({ view: effect.view, ...(effect.week ? { week: effect.week } : {}), ...(effect.post ? { post: effect.post } : {}), sheet: null }, "push")
      if (effect.week) onWeek?.(effect.week)
      if (effect.view === "interface" && effect.post) {
        window.setTimeout(() => document.querySelector<HTMLElement>(`[data-post-id="${effect.post}"]`)?.focus(), 80)
      }
    },
    [onWeek, update],
  )
  const rail = (collapse?: () => void, touch = false) => (
    <ProductRail period={period} weekStart={weekStart} categoryFilter={categoryFilter} categorySummary={categorySummary} onOpenPost={openPost} onCollapse={collapse} density={touch ? "touch" : "pointer"} onClose={touch ? () => onSheetOpenChange(false) : undefined} />
  )
  return (
    <AgenticRuntime
      cadencePerWeek={cadencePerWeek}
      campaignCount={campaignCount}
      posts={posts}
      events={events}
      surfaceContext={surfaceContext}
      onNavigate={onNavigate}
    >
      <ShortcutOwner />
      <div data-slot="agentic-root" data-reduced-motion={reducedAttr} className="relative flex min-h-0 flex-1 overflow-hidden">
        <LiveRegions />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col" aria-hidden={overlay || undefined} inert={overlay || undefined}>
          {children}
        </div>
        {!overlay && !overviewCollapsed ? <div className="hidden min-h-0 w-80 shrink-0 @7xl/iface:flex">{rail(onCollapseOverview)}</div> : null}
        <OrbLayer onOpenOverview={onOpenOverview} weekStart={weekStart} surfaceContext={surfaceContext} />
      </div>
      <Sheet open={sheetOpen && !overlay} onOpenChange={onSheetOpenChange}>
        <SheetContent side="right" className="max-w-full p-0" style={{ width: "min(20rem, 100vw)" }} showCloseButton={false}>
          <SheetHeader className="sr-only">
            <SheetTitle>{copy.iface.rail.title}</SheetTitle>
          </SheetHeader>
          {rail(undefined, true)}
        </SheetContent>
      </Sheet>
    </AgenticRuntime>
  )
}

const NO_DAYS: { name: string; date: string }[] = []

export function CalendarOrb({
  children,
  team,
  workspaceName,
  assistantName,
  prefs,
  awarenessDays = NO_DAYS,
  viewerId,
  initialView,
  surfaceContext = "Calendar",
  ...runtime
}: Omit<RuntimeProps, "events"> & {
  team: TeamMember[]
  workspaceName: string
  assistantName: string
  prefs: PresencePrefs
  awarenessDays?: { name: string; date: string }[]
  viewerId: string
  initialView: ViewState
  surfaceContext?: string
}) {
  return (
    <AgenticProviders
      team={team}
      viewerId={viewerId}
      workspaceName={workspaceName}
      assistantName={assistantName}
      prefs={prefs}
      initialView={surfaceContext === "Calendar" ? { ...initialView, week: runtime.weekStart, filter: runtime.filter } : initialView}
    >
      <OrbRuntime {...runtime} events={awarenessDays} surfaceContext={surfaceContext}>
        {children}
      </OrbRuntime>
    </AgenticProviders>
  )
}
