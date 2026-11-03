"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { format, parseISO } from "date-fns"
import { MotionConfig } from "framer-motion"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { OverviewRail } from "@/components/mockup/agentic/interface/overview-rail"
import type { WithId } from "@/lib/firebase/serialize"
import type { Post } from "@/lib/schemas"
import { deriveChip } from "@/components/mockup/agentic/engine/reducer"
import { EngineProvider, useEngine } from "@/components/mockup/agentic/engine/engine-context"
import { HandoffProvider, useHandoff } from "@/components/mockup/agentic/handoff/handoff-context"
import { Flyout } from "@/components/mockup/agentic/interface/flyout"
import { OrbDock } from "@/components/mockup/agentic/interface/orb-dock"
import { useOrbDrag } from "@/components/mockup/agentic/interface/use-orb-drag"
import { TOAST_UNDO_MS, tw } from "@/components/mockup/agentic/lib"
import { LiveAnnouncerProvider, useAnnounce } from "@/components/mockup/agentic/live-announcer"
import { Composer } from "@/components/mockup/agentic/primitives/composer"
import { micReducer } from "@/components/mockup/agentic/primitives/mic-machine"
import { deriveOrbState } from "@/components/mockup/agentic/primitives/orb-machine"
import { AssistantAvatar } from "@/components/mockup/agentic/primitives/presence-orb"
import { PrototypeProvider, usePrototype } from "@/components/mockup/agentic/prototype-context"
import type { EngineEffect, MicState } from "@/components/mockup/agentic/types"
import { DEFAULT_VIEW } from "@/components/mockup/agentic/view-state"
import { ActivitySurface } from "@/components/mockup/agentic/overlays/activity-surface"
import { PersonaPresenceSheet } from "@/components/mockup/agentic/overlays/persona-presence-sheet"
import { ApprovalCard } from "@/components/mockup/agentic/primitives/approval-card"
import { TEAM } from "@/components/mockup/agentic/fixtures"
import { TimblModeView } from "@/components/mockup/agentic/views/timbl-mode-view"

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
    const mq = window.matchMedia("(max-width: 767px)")
    const apply = () => setNarrow(mq.matches)
    apply()
    mq.addEventListener("change", apply)
    const open = () => update({ view: "timbl", sheet: null }, "push")
    const ask = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; title: string }>).detail
      if (!detail?.title) return
      setAsked(detail)
      update({ sheet: "flyout" }, "push")
    }
    window.addEventListener("timbl:open", open)
    window.addEventListener("timbl:ask", ask)
    return () => {
      mq.removeEventListener("change", apply)
      window.removeEventListener("timbl:open", open)
      window.removeEventListener("timbl:ask", ask)
    }
  }, [update])

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
  onOpenPost,
  onCollapse,
}: {
  period: string
  posts: WithId<Post>[]
  campaignCount: number
  onOpenPost: (post: WithId<Post>) => void
  onCollapse?: () => void
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
        slots: Math.max(0, 7 - new Set(posts.map((post) => post.scheduledDate)).size),
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
    />
  )
}

function OrbRuntime({
  children,
  onOpenOverview,
  onMode,
  period,
  posts,
  campaignCount,
  onOpenPost,
  overviewCollapsed,
  onCollapseOverview,
  sheetOpen,
  onSheetOpenChange,
}: {
  children: React.ReactNode
  onOpenOverview?: () => void
  onMode?: (timbl: boolean) => void
  period: string
  posts: WithId<Post>[]
  campaignCount: number
  onOpenPost: (post: WithId<Post>) => void
  overviewCollapsed: boolean
  onCollapseOverview: () => void
  sheetOpen: boolean
  onSheetOpenChange: (open: boolean) => void
}) {
  const { view, update } = usePrototype()
  const timbl = view.view === "timbl"
  useEffect(() => {
    onMode?.(timbl)
    if (timbl) onSheetOpenChange(false)
  }, [onMode, onSheetOpenChange, timbl])
  const announce = useAnnounce()
  const undoDispatchRef = useRef<((event: NonNullable<Extract<EngineEffect, { type: "toast" }>["undo"]>) => void) | null>(null)
  const onEffect = useCallback(
    (effect: EngineEffect) => {
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
      } else if (effect.type === "open_sheet") {
        update({ sheet: effect.sheet, ...(effect.post ? { post: effect.post } : {}) }, "push")
      } else if (effect.type === "canvas_shown") {
        update({ canvas: "shown" })
      }
    },
    [announce, update],
  )
  const reduced = view.motion === "reduced"
  const rail = (
    <ProductRail
      period={period}
      posts={posts}
      campaignCount={campaignCount}
      onOpenPost={onOpenPost}
      onCollapse={onCollapseOverview}
    />
  )
  return (
    <MotionConfig reducedMotion={reduced ? "always" : "user"}>
      <EngineProvider onEffect={onEffect}>
        <HandoffProvider>
          <div className="relative flex min-h-0 flex-1 overflow-hidden -mb-[var(--ask-ai-clearance)]">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
            {!timbl && !overviewCollapsed ? <div className="hidden min-h-0 xl:flex">{rail}</div> : null}
            <OrbLayer
              onOpenOverview={onOpenOverview}
              attention={posts.filter((post) => post.agentMeta?.reviewState === "pending" || post.status === "review").length}
            />
          </div>
          <Sheet open={sheetOpen && !timbl} onOpenChange={onSheetOpenChange}>
            <SheetContent side="right" className="w-80 max-w-[85vw] p-0 xl:hidden">
              <SheetHeader className="sr-only">
                <SheetTitle>Overview</SheetTitle>
              </SheetHeader>
              <ProductRail period={period} posts={posts} campaignCount={campaignCount} onOpenPost={onOpenPost} />
            </SheetContent>
          </Sheet>
          <OrbSheets />
        </HandoffProvider>
      </EngineProvider>
    </MotionConfig>
  )
}

function OrbSheets() {
  const { view, dismiss, prefs, setPrefs, assistantName, setAssistantName, role, copy } = usePrototype()
  const { state, dispatch } = useEngine()
  const [tab, setTab] = useState<"needs" | "log">("needs")
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
        team={TEAM}
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
        onSave={(name, nextPrefs) => {
          setAssistantName(name)
          setPrefs(nextPrefs)
          toast(copy.persona.saved)
          dismiss({ sheet: null })
        }}
        onCancel={() => dismiss({ sheet: null })}
      />
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
  onOpenPost,
  overviewCollapsed,
  onCollapseOverview,
  sheetOpen,
  onSheetOpenChange,
}: {
  children: React.ReactNode
  onOpenOverview?: () => void
  onMode?: (timbl: boolean) => void
  period: string
  posts: WithId<Post>[]
  campaignCount: number
  onOpenPost: (post: WithId<Post>) => void
  overviewCollapsed: boolean
  onCollapseOverview: () => void
  sheetOpen: boolean
  onSheetOpenChange: (open: boolean) => void
}) {
  return (
    <PrototypeProvider syncUrl={false} initialView={{ ...DEFAULT_VIEW, view: "interface", toolbar: false }}>
      <LiveAnnouncerProvider>
        <OrbRuntime
          onOpenOverview={onOpenOverview}
          onMode={onMode}
          period={period}
          posts={posts}
          campaignCount={campaignCount}
          onOpenPost={onOpenPost}
          overviewCollapsed={overviewCollapsed}
          onCollapseOverview={onCollapseOverview}
          sheetOpen={sheetOpen}
          onSheetOpenChange={onSheetOpenChange}
        >
          {children}
        </OrbRuntime>
      </LiveAnnouncerProvider>
    </PrototypeProvider>
  )
}
