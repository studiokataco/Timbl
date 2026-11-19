"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowUpRight, PanelRightOpen, Settings2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AmbientGlow } from "../ambient/ambient-glow"
import { MeshBackdrop } from "../ambient/mesh-backdrop"
import { envelopeDurationMs } from "../ambient/output-envelope"
import { WorkingStatement } from "../ambient/working-statement"
import { CanvasCardRenderer } from "../cards/card-renderer"
import { deriveChip, deriveRail } from "../engine/reducer"
import { mondayOf, todayIso } from "../clock"
import { useEngine } from "../engine/engine-context"
import { applySpokenTool, useLiveSession } from "../voice/use-live-session"
import { useScriptedUtterance } from "../voice/scripted"
import { TOUCH, tw } from "../lib"
import { CanvasBottomSheet } from "../mobile/canvas-bottom-sheet"
import { AgenticCard } from "../primitives/agentic-card"
import { ApprovalCard } from "../primitives/approval-card"
import { CanvasEmpty, CanvasFrame } from "../primitives/canvas-frame"
import { Composer } from "../primitives/composer"
import { micReducer, type MicEvent } from "../primitives/mic-machine"
import { deriveOrbState } from "../primitives/orb-machine"
import { PlanCard } from "../primitives/plan-card"
import { AssistantAvatar, PresenceOrb } from "../primitives/presence-orb"
import { StateChip } from "../primitives/state-chip"
import { Transcript } from "../primitives/transcript"
import { usePrototype } from "../prototype-context"
import type { MicState, TranscriptAttachment } from "../types"

export type TimblModeViewProps = {
  chrome: "desktop" | "mobile-screen"
  onBack?: () => void
  attention?: number
  lead?: React.ReactNode
  titleSlot?: React.ReactNode
  actions?: React.ReactNode
  modeSwitch?: React.ReactNode
  belowComposer?: React.ReactNode
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"
}

export function TimblModeView({ chrome, onBack, attention = 0, lead, titleSlot, actions, modeSwitch, belowComposer }: TimblModeViewProps): React.JSX.Element {
  const { copy, view, update, setAmbient, prefs, assistantName, role, viewer } = usePrototype()
  const { state, dispatch, env } = useEngine()
  const stats = deriveRail(state, viewer, view.week || mondayOf(todayIso()), env).stats
  const [text, setText] = useState<string | null>(null)
  const [mic, setMic] = useState<MicState>("idle")
  const [handsFree, setHandsFree] = useState(false)
  const voice = useLiveSession({
    onTool: (tool) => applySpokenTool(tool, dispatch, state.deck.order[state.deck.index] ?? null),
    instruction: copy.prompts.liveSystem,
  })
  useScriptedUtterance(dispatch, state.deck.order[state.deck.index] ?? null)
  const [detent, setDetent] = useState<"peek" | "half" | "full">(() =>
    view.canvas === "expanded" ? "full" : state.canvas.card ? "half" : "peek",
  )
  const [sheetHeight, setSheetHeight] = useState(88)
  const [dismissedCap, setDismissedCap] = useState(false)
  const [containerWidth, setContainerWidth] = useState(1280)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const composerValue = text ?? state.composerDraft
  const isWide = chrome === "desktop" && containerWidth >= 1024
  const density = chrome === "mobile-screen" || containerWidth < 768 ? "touch" : "pointer"

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
  const chip = deriveChip(state, copy)
  const pendingCount = state.requests.filter((r) => r.status === "pending").length
  const micState: MicState = voice.talkState === "denied" ? "denied" : mic
  const orbState = deriveOrbState({
    forced: null,
    mic: micState,
    run: state.run,
    pendingRequests: pendingCount + attention,
    lastEventKind: state.lastEventKind,
  })

  const running = state.run?.status === "running"
  const listening = micState === "listening" || handsFree
  const lastEntry = state.transcript[state.transcript.length - 1]
  const replyId = lastEntry?.role === "assistant" && state.lastEventKind === "user" ? lastEntry.id : null
  const replyChars = replyId ? (lastEntry?.text ?? "").length : 0
  const speaking = voice.playing
  const level = listening || speaking ? voice.level : 0

  useEffect(() => {
    const source = listening ? "mic" : speaking || replyId ? "output" : null
    setAmbient({ active: true, working: running, source, outputId: replyId, outputChars: replyChars, level })
    if (source !== "output" || replyChars === 0) return undefined
    const timer = window.setTimeout(() => setAmbient({ source: null, outputId: null, outputChars: 0 }), envelopeDurationMs(replyChars))
    return () => window.clearTimeout(timer)
  }, [level, listening, replyChars, replyId, running, setAmbient, speaking])

  useEffect(() => {
    return () => {
      setAmbient({ active: false, source: null, working: false, outputId: null, outputChars: 0, level: 0 })
    }
  }, [setAmbient])

  // "/" shortcut to focus composer
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!prefs.shortcuts || isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === "/") {
        e.preventDefault()
        textareaRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [prefs.shortcuts])

  const handleMicEvent = useCallback(
    (event: MicEvent) => {
      setMic((prev) => {
        const next = micReducer(prev, event, false)
        if (next === "listening" && prev !== "listening") void voice.startDictate()
        if (next === "transcribing") {
          const heard = voice.consume()
          void voice.close()
          if (heard) setText((curr) => (curr ? `${curr} ${heard}` : heard))
          setMic("idle")
          return "idle"
        }
        if (next === "idle" && event.type === "cancel") void voice.close()
        return next
      })
    },
    [voice],
  )

  const handleTalkPress = useCallback(() => {
    if (chrome === "mobile-screen") {
      void voice.startTalk()
      update({ sheet: "talk" }, "push")
      return
    }
    if (handsFree) {
      const heard = voice.consume()
      void voice.close()
      setHandsFree(false)
      setMic("idle")
      if (heard) dispatch({ type: "user_sent", text: heard, source: "voice" })
    } else {
      setHandsFree(true)
      setMic("listening")
      void voice.startTalk()
    }
  }, [chrome, dispatch, handsFree, update, voice])

  const runningStepIndex = state.run?.steps.findIndex((s) => s.state === "running") ?? -1
  const runningStep = runningStepIndex >= 0 ? (state.run?.steps[runningStepIndex] ?? null) : null
  const workingNode =
    state.run?.status === "running" && runningStep ? (
      <WorkingStatement
        step={runningStep}
        index={runningStepIndex + 1}
        total={state.run.steps.length}
        loader="webgl"
      />
    ) : null

  const scrollToApproval = useCallback(() => {
    setDetent("peek")
    window.setTimeout(() => {
      const el = scrollerRef.current?.querySelector<HTMLElement>("[data-slot=agentic-approval-card], [data-figma='ApprovalCard/root']")
      el?.scrollIntoView({ block: "nearest" })
    }, 60)
  }, [])

  const renderAttachment = useCallback(
    (attachment: TranscriptAttachment): React.ReactNode => {
      if (attachment.kind === "plan") {
        const run = state.runs.find((r) => r.id === attachment.runId) ?? state.run
        if (!run) return null
        return (
          <PlanCard
            run={run}
            onStart={() => dispatch({ type: "run_start" })}
            onRevise={() => dispatch({ type: "run_revise" })}
            onStop={() => dispatch({ type: "run_stop" })}
            onRetry={() => dispatch({ type: "retry" })}
          />
        )
      }
      if (attachment.kind === "approval") {
        const req = state.requests.find((r) => r.id === attachment.requestId)
        if (!req) return null
        const reqPosts = req.postIds.map((id) => state.posts[id]).filter((p): p is NonNullable<typeof p> => Boolean(p))
        const canUndo = req.status === "approved" && req.action !== "delete" && state.run?.status !== "done"
        return (
          <div data-slot="agentic-approval-card">
            <ApprovalCard
              request={req}
              posts={reqPosts}
              viewerRole={role}
              onApprove={() => dispatch({ type: "request_resolved", requestId: req.id, outcome: "approved" })}
              onRequestChanges={(feedback) =>
                dispatch({ type: "request_resolved", requestId: req.id, outcome: "changes_requested", feedback })
              }
              onSubmit={() => dispatch({ type: "request_resolved", requestId: req.id, outcome: "approved" })}
              onUndo={canUndo ? () => dispatch({ type: "request_undo", requestId: req.id }) : undefined}
            />
          </div>
        )
      }
      if (attachment.kind === "cap" && !dismissedCap) {
        return (
          <AgenticCard
            id="cap-reached"
            meta={copy.timbl.modeTitle}
            title={copy.cards.shell.capTitle(state.usage.limit)}
            status="cap_reached"
            cap={{
              onSeePlans: () => toast(copy.cards.shell.seePlansToast),
              onLater: () => setDismissedCap(true),
            }}
          >
            <p className="text-body-sm text-muted-foreground">{copy.cards.shell.capBody}</p>
          </AgenticCard>
        )
      }
      return null
    },
    [copy.cards.shell, copy.timbl.modeTitle, dismissedCap, dispatch, role, state.posts, state.requests, state.run, state.runs, state.usage.limit],
  )

  const activeCardKind = state.canvas.card?.kind
  const chipList =
    activeCardKind === "directions"
      ? copy.timbl.chips.directions
      : activeCardKind === "drafts"
        ? copy.timbl.chips.drafts
        : activeCardKind === "current_item"
          ? copy.timbl.chips.current
          : copy.timbl.chips.default
  const suggestions = chipList.map((c) => ({ id: c.label, label: c.label, text: c.text }))

  const remainingTurns = state.usage.limit - state.usage.used
  const capReached = remainingTurns <= 0
  const nearLimitHelper = !capReached && remainingTurns <= 2 ? copy.timbl.nearLimit(remainingTurns) : undefined

  const isEmptyThread = state.transcript.length <= 1
  const visibility = view.canvas
  const expanded = visibility === "expanded"
  const userHiddenCanvas = visibility === "hidden"
  const hiddenCanvas = userHiddenCanvas || (!state.canvas.card && !expanded)
  const contextLine =
    state.context.kind === "post" && state.posts[state.context.postId]
      ? copy.timbl.contextPost(state.posts[state.context.postId]?.brief ?? "post")
      : copy.timbl.contextDefault

  const canvasMeta =
    activeCardKind === "directions"
      ? copy.canvas.meta.directions
      : activeCardKind === "recommendation"
        ? copy.canvas.meta.recommendation
        : activeCardKind === "brief"
          ? copy.canvas.meta.brief
          : activeCardKind === "drafts"
            ? copy.canvas.meta.drafts
            : activeCardKind === "schedule"
              ? copy.canvas.meta.schedule
              : activeCardKind === "handoff"
                ? copy.canvas.meta.handoff
                : activeCardKind === "approvals_queue"
                  ? copy.canvas.meta.approvals
                  : activeCardKind === "current_item" && state.canvas.card?.kind === "current_item"
                    ? copy.canvas.meta.current(state.posts[state.canvas.card.postId]?.brief ?? "")
                    : ""

  const composerNode = (
    <Composer
      id="timbl-composer"
      textareaRef={textareaRef}
      value={composerValue}
      onChange={setText}
      onSend={(value, source) => {
        dispatch({ type: "user_sent", text: value, source })
        setText("")
      }}
      onTalk={handleTalkPress}
      suggestions={suggestions}
      placeholder={
        capReached
          ? copy.timbl.placeholderCap
          : state.run?.status === "running"
            ? copy.timbl.placeholderWorking
            : copy.timbl.placeholder
      }
      helper={nearLimitHelper}
      disabled={capReached ? { reason: copy.cards.shell.capReason } : undefined}
      queued={state.queue.map((q, idx) => ({ id: `q-${idx}`, text: q }))}
      onRemoveQueued={(id) => dispatch({ type: "queue_removed", index: Number(id.slice(2)) })}
      mic={{
        mode: chrome === "mobile-screen" ? "talk" : "inline",
        state: micState,
        onMicEvent: handleMicEvent,
        interim: micState === "listening" ? voice.tokens : undefined,
        handsFree,
      }}
      density={density}
      placement={isEmptyThread && !expanded ? "centered" : "docked"}
    />
  )

  const meshAllowed = prefs.ambient.backgroundMotion && !expanded

  return (
    <div
      ref={rootRef}
      data-slot="agentic-timbl-mode-view"
      data-chrome={chrome}
      data-state={visibility}
      data-figma="TimblModeView/root"
      className="@container/timbl relative isolate flex min-h-0 flex-1 flex-col bg-background text-foreground"
    >
      <AmbientGlow
        scope="container"
        state={
          orbState === "listening"
            ? "listening"
            : orbState === "working" || orbState === "error"
              ? "working"
              : orbState === "done"
                ? "output"
                : "idle"
        }
        enabled={prefs.ambient.glow}
        source={null}
        spread="desktop"
      />
      <header
        data-figma="TimblModeView/topbar"
        className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {lead}
          {chrome === "mobile-screen" && onBack ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={copy.timbl.back}
              onClick={onBack}
              className={TOUCH.icon}
            >
              <ArrowLeft className="size-4" aria-hidden />
            </Button>
          ) : null}
          {titleSlot ?? (
            <>
          <span aria-hidden="true" className="grid size-6 shrink-0 grid-cols-3 gap-0.5 rounded-md bg-surface-dark p-1">
            <span className="rounded-xs bg-badge-emerald" />
            <span className="rounded-xs bg-surface-dark" />
            <span className="rounded-xs bg-badge-orange" />
            <span className="rounded-xs bg-surface-dark" />
            <span className="rounded-xs bg-badge-violet" />
            <span className="rounded-xs bg-surface-dark" />
          </span>
          <PresenceOrb state={orbState} size="sm" />
          <h1 className="shrink-0">
            <span className="text-title-md text-foreground">{copy.timbl.modeTitle}</span>
          </h1>
          <Separator orientation="vertical" className="hidden h-4 @3xl/timbl:block" />
          <span className="hidden truncate text-caption text-muted-foreground @3xl/timbl:inline">{contextLine}</span>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {chip && chip.state !== "working" ? (
            <StateChip
              state={chip.state}
              label={chip.label}
              shortLabel={chip.shortLabel}
              density={density}
              onOpen={() => update({ sheet: "activity" }, "push")}
            />
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={copy.timbl.persona}
            onClick={() => update({ sheet: "persona" }, "push")}
          >
            <Settings2 className="size-4" aria-hidden />
          </Button>

          {userHiddenCanvas ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                dispatch({ type: "canvas_visibility", visibility: "shown" })
                update({ canvas: "shown" })
              }}
              className="hidden @5xl/timbl:inline-flex"
            >
              <PanelRightOpen className="size-4" aria-hidden />
              <span>{copy.timbl.showCanvas}</span>
            </Button>
          ) : null}

          {actions}

          {chrome === "desktop" && modeSwitch ? modeSwitch : null}
          {chrome === "desktop" && !modeSwitch ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => dispatch({ type: "handoff_out" })}
            >
              <span>{copy.timbl.openInterface}</span>
              <ArrowUpRight className="size-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      </header>

      {expanded ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <CanvasFrame
            meta={canvasMeta}
            visibility="expanded"
            onVisibilityChange={(next) => {
              dispatch({ type: "canvas_visibility", visibility: next })
              update({ canvas: next }, "push")
            }}
            layout="column"
            cardKey={activeCardKind ?? "empty"}
          >
            {state.canvas.card ? (
              <CanvasCardRenderer onGoToApproval={scrollToApproval} />
            ) : (
              <CanvasEmpty stats={stats} onStart={() => dispatch({ type: "user_sent", text: copy.timbl.chips.default[0]!.text, source: "chip" })} />
            )}
          </CanvasFrame>
          <div className="mx-auto w-full max-w-180 px-4 py-3">{composerNode}</div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* Transcript + composer column */}
          <div
            onFocusCapture={(event) => {
              if (detent === "half" && !(event.target as HTMLElement).closest("[data-slot=agentic-canvas-bottom-sheet]")) setDetent("peek")
            }}
            className={tw(
              "relative isolate flex min-h-0 flex-col",
              hiddenCanvas
                ? "mx-auto w-full max-w-2xl flex-1"
                : "w-full flex-1 @5xl/timbl:w-100 @5xl/timbl:flex-none @5xl/timbl:border-r @5xl/timbl:border-border @7xl/timbl:w-120",
            )}
          >
            <MeshBackdrop motion={meshAllowed} />

            <div className="relative min-h-0 flex-1">
              <div
                ref={scrollerRef}
                inert={!isWide && detent === "full" ? true : undefined}
                style={
                  !isWide
                    ? {
                        paddingBottom: `${sheetHeight + 16}px`,
                        scrollPaddingBottom: `${sheetHeight + 16}px`,
                      }
                    : undefined
                }
                className="h-full min-h-0 overflow-y-auto px-4 py-6"
              >
                {isEmptyThread ? (
                  <div data-figma="TimblModeView/hello" className="mb-6 flex flex-col items-center gap-2 text-center">
                    <PresenceOrb state={orbState} size="md" />
                    <p className="mt-1 text-balance text-foreground">
                      <span className="text-display-sm @3xl/timbl:hidden">{copy.timbl.hello}</span>
                      <span className="hidden text-display-md @3xl/timbl:inline">{copy.timbl.hello}</span>
                    </p>
                    <p className="max-w-md text-body-sm text-muted-foreground">{copy.timbl.helloSub}</p>
                  </div>
                ) : null}

                <Transcript
                  entries={state.transcript}
                  assistantName={assistantName}
                  assistantAvatar={<AssistantAvatar />}
                  working={workingNode}
                  renderAttachment={renderAttachment}
                  onViewCard={(card) => dispatch({ type: "show_card", card })}
                  touch={density === "touch"}
                />
              </div>

              {!hiddenCanvas && !isWide ? (
                <CanvasBottomSheet
                  detent={detent}
                  onDetentChange={setDetent}
                  onHeightChange={setSheetHeight}
                  title={copy.canvas.title}
                  meta={canvasMeta}
                  hasCard={Boolean(state.canvas.card)}
                >
                  {state.canvas.card ? (
                    <CanvasCardRenderer onGoToApproval={scrollToApproval} />
                  ) : (
                    <CanvasEmpty
                      stats={stats}
                      onStart={() =>
                        dispatch({ type: "user_sent", text: copy.timbl.chips.default[0]!.text, source: "chip" })
                      }
                    />
                  )}
                </CanvasBottomSheet>
              ) : null}
            </div>

            <div className="relative z-30 shrink-0 border-t border-border bg-background px-4 py-3">
              {composerNode}
              {isEmptyThread ? belowComposer : null}
            </div>
          </div>

          {/* Desktop canvas column */}
          {!hiddenCanvas && isWide ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <CanvasFrame
                meta={canvasMeta}
                visibility={visibility}
                onVisibilityChange={(next) => {
                  dispatch({ type: "canvas_visibility", visibility: next })
                  update({ canvas: next }, next === "expanded" ? "push" : "replace")
                }}
                layout="column"
                cardKey={activeCardKind ?? "empty"}
              >
                {state.canvas.card ? (
                  <CanvasCardRenderer onGoToApproval={scrollToApproval} />
                ) : (
                  <CanvasEmpty
                    stats={stats}
                    onStart={() =>
                      dispatch({ type: "user_sent", text: copy.timbl.chips.default[0]!.text, source: "chip" })
                    }
                  />
                )}
              </CanvasFrame>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
