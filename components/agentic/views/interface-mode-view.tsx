"use client"

import { useEffect, useRef, useState } from "react"
import { Eye, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { weekLabel } from "../clock"
import { ContributorApproval } from "../collab/contributor-approval"
import { NoteThread } from "../collab/note-thread"
import { deriveChip, deriveRail } from "../engine/reducer"
import { useEngine } from "../engine/engine-context"
import { CURSOR_SCRIPTS, PEERS_ELSEWHERE } from "../defaults"
import { useHandoff } from "../handoff/handoff-context"
import { AvatarStack, PeerChip } from "../interface/avatar-stack"
import { Flyout } from "../interface/flyout"
import { InterfaceTopBar } from "../interface/interface-top-bar"
import { OrbDock } from "../interface/orb-dock"
import { useOrbDrag } from "../interface/use-orb-drag"
import { OverviewRail } from "../interface/overview-rail"
import { TeamCursors } from "../interface/team-cursors"
import { useFollowMode } from "../interface/use-follow-mode"
import { REDUCED_POPUP, showCursorsEffective, tw, unreadFor } from "../lib"
import { Composer } from "../primitives/composer"
import { micReducer } from "../primitives/mic-machine"
import { deriveOrbState } from "../primitives/orb-machine"
import { AssistantAvatar } from "../primitives/presence-orb"
import { useProductActions } from "../product-actions"
import { useAgenticMotion, usePrototype } from "../prototype-context"
import type { MicState } from "../types"

export function InterfaceModeView({ calendar }: { calendar?: React.ReactNode } = {}): React.JSX.Element {
  const { copy, view, update, dismiss, viewer, team, prefs, setPrefs, replayKey } = usePrototype()
  const product = useProductActions()
  const { reduced } = useAgenticMotion()
  const { state, dispatch } = useEngine()
  const { orbRef, triggerIn } = useHandoff()
  const [miniText, setMiniText] = useState("")
  const [miniMic, setMiniMic] = useState<MicState>("idle")
  const [railOpen, setRailOpen] = useState(true)
  const [containerWidth, setContainerWidth] = useState(1440)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const calendarRef = useRef<HTMLDivElement | null>(null)
  const orbDockRef = useRef<HTMLDivElement | null>(null)
  const orbDrag = useOrbDrag(viewer.id, rootRef, orbDockRef)
  const isWide = containerWidth >= 1280
  const density = containerWidth < 768 ? "touch" : "pointer"

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

  const overviewOpen = isWide ? railOpen : view.sheet === "rail"
  const toggleOverview = () => {
    if (isWide) setRailOpen((open) => !open)
    else if (view.sheet === "rail") dismiss({ sheet: null })
    else update({ sheet: "rail" }, "push")
  }
  const openOverview = () => {
    if (isWide) setRailOpen(true)
    else update({ sheet: "rail" }, "push")
  }

  const week = view.week
  const railData = deriveRail(state, viewer, week)
  const chip = deriveChip(state, copy)
  const pendingCount = state.requests.filter((r) => r.status === "pending").length
  const orbState = deriveOrbState({
    forced: view.orb,
    mic: miniMic,
    run: state.run,
    pendingRequests: pendingCount,
    lastEventKind: state.lastEventKind,
  })

  const activePeers = team.filter((m) => m.id !== viewer.id && CURSOR_SCRIPTS.some((c) => c.userId === m.id))
  const { following, follow, stop } = useFollowMode(activePeers, calendarRef, true)
  const followedMember = activePeers.find((p) => p.id === following)

  const cursorsShown = showCursorsEffective(prefs, reduced) && view.cursors !== "off"
  const unreadByPost: Record<string, { count: number; mentions: number }> = {}
  for (const id of Object.keys(state.posts)) {
    unreadByPost[id] = unreadFor(state.notes, state.reads, id, viewer.id)
  }

  const editingByPost: Record<string, typeof viewer> = {}
  const designer = team.find((m) => m.id === "u-designer")
  if (designer && view.cursors === "live") {
    editingByPost["p-thu"] = designer
  }

  const attentionRows = railData.attention.map((item) => ({
    postId: item.postId,
    title: item.title,
    line:
      item.source === "mention"
        ? copy.notes.mentionDot
        : item.source === "contributor"
          ? copy.approve.status
          : copy.approval.meta,
    unread: item.unread,
  }))

  const comingUpRows = railData.comingUp.map((item) => ({
    postId: item.postId,
    title: item.title,
    when: item.when,
  }))

  const flyoutStatus =
    orbState === "working" && state.run
      ? copy.flyout.statusWorking(
          Math.max(1, state.run.steps.findIndex((s) => s.state === "running") + 1),
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
  const flyoutContext = contextPost
    ? { label: copy.flyout.contextLabel, value: contextPost.brief ?? "Untitled post" }
    : null

  const handleOpenTimbl = (carry: "chat" | "chat_and_item" | "none") => {
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

  const notesPostId = view.post ?? contextPost?.id ?? Object.keys(state.posts)[0]
  const notesPost = notesPostId ? state.posts[notesPostId] : undefined
  const notesSubmission = notesPost ? state.submissions.find((s) => s.postId === notesPost.id) ?? null : null
  const notesList = notesPost ? state.notes.filter((n) => n.postId === notesPost.id) : []
  const notesLastRead = notesPost
    ? state.reads.find((r) => r.postId === notesPost.id && r.userId === viewer.id)?.lastReadAt
    : undefined

  return (
    <div
      ref={rootRef}
      data-slot="agentic-interface-mode-view"
      data-state={week}
      data-figma="InterfaceModeView/root"
      className="@container/iface relative flex min-h-0 flex-1 bg-background text-foreground"
    >
      {/* Center column */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <InterfaceTopBar
          weekStart={week}
          density={density}
          onOpenTimbl={() => handleOpenTimbl("none")}
          onOverview={toggleOverview}
          overviewOpen={overviewOpen}
          onCreate={product.create}
          onSearch={() => window.dispatchEvent(new Event("palette:open"))}
          onMenu={() => update({ sheet: "nav" }, "push")}
          presence={
            <div className="flex items-center gap-2">
              {week === "2026-11-09"
                ? PEERS_ELSEWHERE.map((pe) => {
                    const member = team.find((m) => m.id === pe.userId)
                    return member ? <PeerChip key={pe.userId} member={member} where={pe.where} /> : null
                  })
                : null}
              <AvatarStack
                peers={activePeers.map((member) => ({
                  member,
                  activity: member.id === "u-designer" ? "editing_caption" : "viewing",
                }))}
                cursorsShown={cursorsShown}
                onFollow={follow}
                onToggleCursors={() => setPrefs({ ...prefs, showCursors: !cursorsShown })}
                density={density}
              />
            </div>
          }
        />

        {followedMember ? (
          <div className="sticky top-2 z-30 mx-auto mt-2 flex items-center gap-1.5">
            <Badge variant="outline" className="gap-1.5 bg-background px-3 py-1 shadow-sm">
              <Eye className="size-3.5 text-brand-accent" aria-hidden />
              <span>{copy.iface.cursors.following(followedMember.name)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={copy.iface.cursors.stop}
                onClick={stop}
              >
                <X className="size-3" aria-hidden />
              </Button>
            </Badge>
          </div>
        ) : null}

        <div className="relative min-h-0 flex-1 overflow-y-auto pb-24 scroll-pb-24">
          <div ref={calendarRef} className="relative min-h-0 flex-1">
            {calendar}
            <TeamCursors
              presence={CURSOR_SCRIPTS}
              team={team}
              viewerId={viewer.id}
              week={week}
              mode={view.cursors}
              replayKey={replayKey}
              hidden={!cursorsShown}
            />
          </div>
        </div>
      </div>

      <div
        ref={orbDockRef}
        data-slot="agentic-orb-anchor"
        onPointerDown={orbDrag.onPointerDown}
        onPointerMove={orbDrag.onPointerMove}
        onPointerUp={orbDrag.onPointerUp}
        onPointerCancel={orbDrag.onPointerUp}
        onClickCapture={orbDrag.onClickCapture}
        className={tw(
          "absolute z-30 cursor-grab touch-none select-none active:cursor-grabbing",
          orbDrag.point ? undefined : "right-4 bottom-4 @3xl/iface:right-6 @3xl/iface:bottom-6",
        )}
        style={orbDrag.point ? { left: orbDrag.point.x, top: orbDrag.point.y } : undefined}
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
            layout={density === "touch" ? "sheet" : "popover"}
            status={flyoutStatus}
            context={flyoutContext}
            entries={state.miniChat}
            assistantAvatar={<AssistantAvatar />}
            handoffDisabled={!contextPost}
            density={density}
            onFull={() => handleOpenTimbl("chat")}
            onHandoff={() => handleOpenTimbl("chat_and_item")}
            onNewChat={() => dispatch({ type: "new_mini_chat" })}
            onOpenOverview={openOverview}
            onClose={() => dismiss({ sheet: null })}
            onOpenActivity={() => update({ sheet: "activity" }, "push")}
            composer={
              <Composer
                id="flyout-composer"
                variant="mini"
                value={miniText}
                onChange={setMiniText}
                onSend={(val) => {
                  dispatch({ type: "mini_sent", text: val })
                  setMiniText("")
                }}
                suggestions={[]}
                placeholder={copy.flyout.placeholder}
                mic={{
                  mode: "inline",
                  state: miniMic,
                  onMicEvent: (e) => setMiniMic((s) => micReducer(s, e, false)),
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

      {/* Persistent OverviewRail >= @7xl */}
      {isWide && railOpen ? (
        <OverviewRail
          period={weekLabel(week)}
          stats={railData.stats}
          attention={attentionRows}
          comingUp={comingUpRows}
          onOpenTimbl={() => handleOpenTimbl("none")}
          onOpenPost={(postId) => {
            dispatch({ type: "thread_read", postId })
            update({ post: postId, sheet: "notes" }, "push")
          }}
          onSettings={() => update({ sheet: "persona" }, "push")}
          onCollapse={() => setRailOpen(false)}
        />
      ) : null}

      {/* Rail overlay sheet (`sheet=rail`) */}
      <Sheet open={view.sheet === "rail"} onOpenChange={(open) => !open && dismiss({ sheet: null })}>
        <SheetContent side="right" className={tw("w-80 p-0", reduced && REDUCED_POPUP)}>
          <SheetHeader className="sr-only">
            <SheetTitle>
              <span className="text-title-md">{copy.iface.rail.title}</span>
            </SheetTitle>
          </SheetHeader>
          <OverviewRail
            period={weekLabel(week)}
            stats={railData.stats}
            attention={attentionRows}
            comingUp={comingUpRows}
            onOpenTimbl={() => handleOpenTimbl("none")}
            onOpenPost={(postId) => {
              dispatch({ type: "thread_read", postId })
              update({ post: postId, sheet: "notes" }, "push")
            }}
            onSettings={() => update({ sheet: "persona" }, "push")}
          />
        </SheetContent>
      </Sheet>

      {/* Nav overlay sheet (`sheet=nav`) */}
      <Sheet open={view.sheet === "nav"} onOpenChange={(open) => !open && dismiss({ sheet: null })}>
        <SheetContent side="left" className={tw("w-60 p-0", reduced && REDUCED_POPUP)}>
          <SheetHeader className="sr-only">
            <SheetTitle>
              <span className="text-title-md">{copy.iface.sidebar.navLabel}</span>
            </SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>

      {/* Notes overlay sheet (`sheet=notes`) */}
      <Sheet open={view.sheet === "notes"} onOpenChange={(open) => !open && dismiss({ sheet: null })}>
        <SheetContent
          side="right"
          finalFocus={() => document.querySelector<HTMLElement>(`[data-post-id="${notesPost?.id ?? ""}"]`)}
          className={tw("flex flex-col gap-4 overflow-y-auto p-5", reduced && REDUCED_POPUP)}
        >
          <SheetHeader className="p-0">
            <SheetTitle>
              <span className="text-title-md text-foreground">{copy.iface.calendar.notesTitle(notesPost?.brief ?? "post")}</span>
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
          {notesPost ? <NoteThread
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
          /> : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
