"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowUp, AudioLines, CircleAlert, LoaderCircle, Mic, MicOff, Square, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useAgenticMotion, usePrototype } from "../prototype-context"
import { DUR, EASE_OUT, REDUCED_POPUP, TOUCH, tw } from "../lib"
import type { MicState, VoiceToken } from "../types"
import type { MicEvent } from "./mic-machine"
import { PresenceOrb } from "./presence-orb"

type ComposerProps = {
  id: string
  value: string
  onChange: (value: string) => void
  onSend: (text: string, source: "typed" | "voice" | "chip") => void
  onTalk?: () => void
  suggestions: { id: string; label: string; text: string }[]
  placeholder: string
  helper?: string
  mic: { mode: "inline" | "talk"; state: MicState; onMicEvent: (e: MicEvent) => void; interim?: VoiceToken[]; handsFree?: boolean }
  disabled?: { reason: string }
  queued?: { id: string; text: string }[]
  onRemoveQueued?: (id: string) => void
  variant?: "full" | "mini"
  placement?: "centered" | "docked"
  density: "touch" | "pointer"
  autoFocus?: boolean
  textareaRef?: React.Ref<HTMLTextAreaElement>
}

type Face = "talk" | "stop" | "send"

const HOLD_MS = 250
const UNSTACK_RATIO = 0.5
const ACTIONS_ROOM_PX = 24

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) return
  if (typeof ref === "function") ref(value)
  else (ref as React.RefObject<T | null>).current = value
}

export function Composer({
  id,
  value,
  onChange,
  onSend,
  onTalk,
  suggestions,
  placeholder,
  helper,
  mic,
  disabled,
  queued = [],
  onRemoveQueued,
  variant = "full",
  placement = "docked",
  density,
  autoFocus,
  textareaRef,
}: ComposerProps): React.JSX.Element {
  const { copy } = usePrototype()
  const { reduced } = useAgenticMotion()
  const helperId = useId()
  const hintId = useId()
  const noteId = useId()
  const textarea = useRef<HTMLTextAreaElement | null>(null)
  const mirror = useRef<HTMLSpanElement | null>(null)
  const hold = useRef<{ timer: ReturnType<typeof setTimeout> | null; down: boolean; holding: boolean; suppressClick: boolean }>({
    timer: null,
    down: false,
    holding: false,
    suppressClick: false,
  })
  const [stacked, setStacked] = useState(() => value.includes("\n"))

  const mini = variant === "mini"
  const isDisabled = Boolean(disabled)
  const hasText = value.trim().length > 0
  const inline = mic.mode === "inline"
  const listening = inline && mic.state === "listening"
  const handsFreeActive = inline && Boolean(mic.handsFree) && (mic.state === "requesting" || mic.state === "listening" || mic.state === "transcribing")
  const interim = inline && (mic.state === "listening" || mic.state === "transcribing") ? (mic.interim ?? []) : []
  const showInterim = interim.length > 0
  const layoutStacked = (!mini && stacked) || showInterim
  const face: Face = handsFreeActive ? "stop" : hasText || mini || !onTalk ? "send" : "talk"
  const iconButton = density === "touch" ? TOUCH.icon : "size-9"

  const setTextareaRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      textarea.current = node
      assignRef(textareaRef, node)
    },
    [textareaRef],
  )

  useEffect(() => {
    const area = textarea.current
    const measure = mirror.current
    if (!area || !measure || mini) return
    const decide = () => {
      const text = area.value
      const textWidth = measure.getBoundingClientRect().width
      const room = area.clientWidth
      setStacked((was) => {
        if (text.includes("\n")) return true
        if (!was) return textWidth > room - ACTIONS_ROOM_PX || area.scrollHeight > area.clientHeight + 2
        return textWidth > room * UNSTACK_RATIO
      })
    }
    const observer = new ResizeObserver(decide)
    observer.observe(area)
    observer.observe(measure)
    return () => observer.disconnect()
  }, [mini])

  useEffect(() => {
    const state = hold.current
    return () => {
      if (state.timer) clearTimeout(state.timer)
    }
  }, [])

  const send = () => {
    if (isDisabled) return
    const text = value.trim()
    if (!text) return
    onSend(text, "typed")
  }

  const cancelMic = () => {
    if (inline && (mic.state === "listening" || mic.state === "requesting" || mic.state === "transcribing")) {
      mic.onMicEvent({ type: "cancel" })
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      if (inline && (mic.state === "listening" || mic.state === "requesting" || mic.state === "transcribing")) {
        e.preventDefault()
        cancelMic()
      }
      return
    }
    if (e.key !== "Enter") return
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    const modifier = e.metaKey || e.ctrlKey
    if (e.shiftKey && !modifier) return
    e.preventDefault()
    send()
  }

  const clearHold = () => {
    if (hold.current.timer) clearTimeout(hold.current.timer)
    hold.current.timer = null
  }

  const micPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!inline || e.button !== 0) return
    clearHold()
    hold.current.down = true
    hold.current.holding = false
    hold.current.timer = setTimeout(() => {
      hold.current.timer = null
      hold.current.holding = true
      mic.onMicEvent({ type: "hold_start" })
    }, HOLD_MS)
  }

  const micPointerUp = () => {
    if (!hold.current.down) return
    hold.current.down = false
    hold.current.suppressClick = true
    clearHold()
    if (hold.current.holding) {
      hold.current.holding = false
      mic.onMicEvent({ type: "hold_end" })
    } else {
      mic.onMicEvent({ type: "press" })
    }
  }

  const micPointerCancel = () => {
    if (!hold.current.down) return
    hold.current.down = false
    clearHold()
    if (hold.current.holding) mic.onMicEvent({ type: "hold_end" })
    hold.current.holding = false
  }

  const micClick = () => {
    if (hold.current.suppressClick) {
      hold.current.suppressClick = false
      return
    }
    mic.onMicEvent({ type: "press" })
  }

  const micView = (() => {
    if (!inline) return { icon: Mic, name: copy.mic.start, spin: false, busy: false }
    switch (mic.state) {
      case "listening":
        return mic.handsFree ? { icon: Mic, name: copy.mic.start, spin: false, busy: true } : { icon: Square, name: copy.mic.stop, spin: false, busy: false }
      case "transcribing":
        return { icon: LoaderCircle, name: copy.mic.transcribing, spin: true, busy: true }
      case "denied":
        return { icon: MicOff, name: copy.mic.denied, spin: false, busy: false }
      case "requesting":
        return { icon: Mic, name: copy.mic.start, spin: false, busy: true }
      default:
        return { icon: Mic, name: copy.mic.start, spin: false, busy: false }
    }
  })()
  const MicIcon = micView.icon
  const micDisabled = isDisabled || micView.busy

  const primaryName = face === "stop" ? copy.timbl.talkStop : face === "talk" ? copy.timbl.talk : copy.timbl.send
  const primaryDisabled =
    face === "stop" ? mic.state !== "listening" : face === "talk" ? isDisabled : isDisabled || !hasText
  const primaryClick = () => {
    if (face === "stop") mic.onMicEvent({ type: "endpoint" })
    else if (face === "talk") onTalk?.()
    else send()
  }
  const PrimaryIcon = face === "stop" ? Square : face === "talk" ? AudioLines : ArrowUp
  const fade = reduced ? { duration: 0 } : { duration: 0.15, ease: EASE_OUT }

  const note = (() => {
    if (!inline) return null
    if (mic.state === "requesting") return "requesting"
    if (mic.state === "denied") return "denied"
    if (mic.state === "error") return "error"
    return null
  })()

  const describedBy = [helper || disabled ? helperId : null, !mini ? hintId : null, note ? noteId : null].filter(Boolean).join(" ") || undefined
  const visibleSuggestions = mini ? [] : suggestions.slice(0, 4)

  const actions = (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <InputGroupButton
              variant="ghost"
              size="icon-sm"
              aria-label={micView.name}
              disabled={micDisabled}
              onPointerDown={micPointerDown}
              onPointerUp={micPointerUp}
              onPointerLeave={micPointerCancel}
              onPointerCancel={micPointerCancel}
              onClick={micClick}
              data-figma="Composer/mic"
              className={tw(mini ? "rounded-lg" : "rounded-full", iconButton)}
            />
          }
        >
          <MicIcon
            aria-hidden="true"
            className={tw(MicIcon === Square ? "size-3.5 fill-current" : "size-4", micView.spin && !reduced && "animate-spin")}
          />
        </TooltipTrigger>
        <TooltipContent className={reduced ? REDUCED_POPUP : undefined}>{micView.name}</TooltipContent>
      </Tooltip>
      {face === "talk" ? (
        <button
          type="button"
          aria-label={primaryName}
          disabled={primaryDisabled}
          onClick={primaryClick}
          data-figma="Composer/primary"
          data-face={face}
          className="rounded-full focus-ring"
        >
          <PresenceOrb state="idle" size="sm" />
        </button>
      ) : (
        <Button
          type="button"
          size="icon"
          aria-label={primaryName}
          disabled={primaryDisabled}
          onClick={primaryClick}
          data-figma="Composer/primary"
          data-face={face}
          className={tw(mini ? "rounded-lg" : "rounded-full", iconButton)}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={face}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
              className="inline-flex"
            >
              <PrimaryIcon aria-hidden="true" className={tw("size-4", face === "stop" && "fill-current")} />
            </motion.span>
          </AnimatePresence>
        </Button>
      )}
    </>
  )

  return (
    <motion.div
      layout="position"
      transition={{ layout: reduced ? { duration: 0 } : { duration: DUR.layout, ease: EASE_OUT } }}
      data-slot="agentic-composer"
      data-state={mic.state}
      data-placement={placement}
      data-shape={layoutStacked ? "stacked" : "round"}
      data-figma="Composer/root"
      onKeyDown={(e) => {
        if (e.key !== "Escape") return
        if (inline && (mic.state === "listening" || mic.state === "requesting" || mic.state === "transcribing")) {
          e.preventDefault()
          cancelMic()
        }
      }}
      className={tw(
        "relative z-10 flex w-full shrink-0 flex-col gap-2 bg-transparent",
        mini ? "px-3 pt-2 pb-3" : "px-4 pt-2 pb-4",
        placement === "centered" && "mx-auto max-w-xl",
      )}
    >
      {queued.length > 0 && (
        <ul data-figma="Composer/queued" className="flex flex-wrap gap-2">
          {queued.map((item) => (
            <li key={item.id} className="inline-flex h-7 max-w-full items-center gap-1 rounded-full bg-muted pr-1 pl-3">
              <span id={`${id}-queued-${item.id}`} className="truncate text-xs font-medium text-foreground">
                {item.text}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={copy.timbl.removeQueued}
                aria-describedby={`${id}-queued-${item.id}`}
                onClick={() => onRemoveQueued?.(item.id)}
                className={tw("rounded-full", density === "touch" && TOUCH.icon)}
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {visibleSuggestions.length > 0 && (
        <ul data-figma="Composer/suggestions" className="flex flex-wrap gap-2">
          {visibleSuggestions.map((s) => (
            <li key={s.id}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDisabled}
                onClick={() => onSend(s.text, "chip")}
                className={tw("rounded-full", density === "touch" && TOUCH.control)}
              >
                <span className="text-xs">{s.label}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}

      <InputGroup
        data-figma="Composer/surface"
        className={tw(
          "min-h-10 border-0 bg-background pl-2",
          !isDisabled && "has-disabled:bg-background has-disabled:opacity-100 dark:has-disabled:bg-input/30",
          layoutStacked ? "rounded-2xl" : mini ? "rounded-xl" : "rounded-full",
          listening ? "ring-2 ring-brand-accent" : "ring-1 ring-foreground/10",
        )}
      >
        {showInterim && (
          <InputGroupAddon align="block-start" aria-hidden="true" data-figma="Composer/interim" className="cursor-default">
            <span className="text-body-sm">
              {interim.map((token, index) => (
                <span key={`${token.atMs}-${index}`} className={token.final ? "text-foreground" : "text-muted-foreground"}>
                  {index > 0 ? " " : ""}
                  {token.text}
                </span>
              ))}
            </span>
          </InputGroupAddon>
        )}
        <InputGroupTextarea
          id={id}
          ref={setTextareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={isDisabled ? copy.timbl.placeholderCap : showInterim ? "" : placeholder}
          aria-label={copy.timbl.messageLabel}
          aria-describedby={describedBy}
          disabled={isDisabled}
          autoFocus={autoFocus}
          rows={1}
          data-figma="Composer/input"
          className="max-h-40 min-h-10"
        />
        <InputGroupAddon
          align={layoutStacked ? "block-end" : "inline-end"}
          data-figma="Composer/actions"
          className={tw("gap-1", layoutStacked && "justify-end")}
        >
          {actions}
        </InputGroupAddon>
        <div aria-hidden="true" className="pointer-events-none invisible absolute inset-0 overflow-hidden">
          <span ref={mirror} className="absolute top-0 left-0 whitespace-pre text-base">
            {value.split("\n")[0]}
          </span>
        </div>
      </InputGroup>

      {note === "requesting" && (
        <div id={noteId} data-figma="Composer/permission" className="flex flex-wrap items-center gap-2">
          <p className="flex-1 text-caption text-muted-foreground">
            <span className="text-foreground">{copy.mic.permissionTitle}</span> {copy.mic.permissionBody}
          </p>
          <Button type="button" size="xs" onClick={() => mic.onMicEvent({ type: "permission", granted: true })} className={density === "touch" ? TOUCH.control : undefined}>
            {copy.mic.continue}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => mic.onMicEvent({ type: "permission", granted: false })}
            className={density === "touch" ? TOUCH.control : undefined}
          >
            {copy.mic.notNow}
          </Button>
        </div>
      )}
      {note === "denied" && (
        <p id={noteId} data-figma="Composer/denied" className="flex items-center gap-1.5 text-caption text-muted-foreground">
          <MicOff aria-hidden="true" className="size-4 shrink-0" />
          {copy.mic.deniedNote}
        </p>
      )}
      {note === "error" && (
        <p id={noteId} data-figma="Composer/error" className="flex items-center gap-1.5 text-caption text-foreground">
          <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-destructive" />
          {copy.mic.errorNote}
        </p>
      )}
      {(disabled || helper) && (
        <p id={helperId} data-figma="Composer/helper" className="text-caption text-muted-foreground">
          {disabled ? disabled.reason : helper}
        </p>
      )}
      {!mini && (
        <p id={hintId} data-figma="Composer/hint" className="text-caption text-muted-foreground">
          {copy.timbl.sendHint}
        </p>
      )}
    </motion.div>
  )
}
