"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowDown, AudioLines } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DisclosureTrigger } from "@/components/ui/disclosure"
import { Separator } from "@/components/ui/separator"
import { useAgenticMotion, usePrototype } from "../prototype-context"
import { BUBBLE_ENTER, DUR, EASE_OUT, TOUCH, tw } from "../lib"
import type { CanvasCard, RichSpan, TranscriptAttachment, TranscriptEntry } from "../types"

type TranscriptProps = {
  entries: TranscriptEntry[]
  assistantName: string
  writing?: boolean
  working?: React.ReactNode
  assistantAvatar: React.ReactNode
  renderAttachment: (attachment: TranscriptAttachment, entry: TranscriptEntry) => React.ReactNode
  onViewCard?: (card: CanvasCard) => void
  scrollRef?: React.Ref<HTMLDivElement>
  density?: "full" | "mini"
  touch?: boolean
  onShowEarlier?: () => void
}

type Sender = "user" | "assistant"
type Row =
  | { kind: "divider"; entry: TranscriptEntry }
  | { kind: "message"; entry: TranscriptEntry; sender: Sender; first: boolean; last: boolean }

const JUMP_THRESHOLD_PX = 120
const MINI_LIMIT = 4
const BOLD = /\*\*([^*\n]+)\*\*/g

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) return
  if (typeof ref === "function") ref(value)
  else (ref as React.RefObject<T | null>).current = value
}

export function RichText({ text, className }: { text: string; className?: string }): React.JSX.Element {
  const parts: React.ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(BOLD)) {
    const at = match.index ?? 0
    if (at > last) parts.push(text.slice(last, at))
    parts.push(
      <strong key={at} className="font-semibold">
        {match[1]}
      </strong>,
    )
    last = at + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return (
    <span data-slot="agentic-rich-text" className={className}>
      {parts}
    </span>
  )
}

function RichSpans({ spans, className }: { spans: RichSpan[]; className?: string }) {
  return (
    <span data-slot="agentic-rich-text" className={className}>
      {spans.map((span, index) =>
        span.strong ? (
          <strong key={index} className={tw("font-semibold", span.muted && "text-muted-foreground")}>
            {span.text}
          </strong>
        ) : (
          <span key={index} className={span.muted ? "text-muted-foreground" : undefined}>
            {span.text}
          </span>
        ),
      )}
    </span>
  )
}

function senderOf(entry: TranscriptEntry): Sender | null {
  if (entry.divider || entry.role === "system") return null
  return entry.role === "user" ? "user" : "assistant"
}

function toRows(entries: TranscriptEntry[]): Row[] {
  const rows: Row[] = []
  entries.forEach((entry, index) => {
    const sender = senderOf(entry)
    if (!sender) {
      rows.push({ kind: "divider", entry })
      return
    }
    const prev = entries[index - 1]
    const next = entries[index + 1]
    const continues = (a: TranscriptEntry | undefined, b: TranscriptEntry) =>
      Boolean(a) && senderOf(a as TranscriptEntry) === senderOf(b) && !(a as TranscriptEntry).attachments?.length
    const first = !continues(prev, entry)
    const last = !(next && continues(entry, next))
    rows.push({ kind: "message", entry, sender, first, last })
  })
  return rows
}

function bubbleCorners(sender: Sender, first: boolean): string {
  if (sender === "user") return first ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-r-md"
  return first ? "rounded-2xl rounded-bl-md" : "rounded-2xl rounded-l-md"
}

export function Transcript({
  entries,
  assistantName,
  writing,
  working,
  assistantAvatar,
  renderAttachment,
  onViewCard,
  scrollRef,
  density = "full",
  touch = false,
  onShowEarlier,
}: TranscriptProps): React.JSX.Element {
  const { copy } = usePrototype()
  const { reduced } = useAgenticMotion()
  const mini = density === "mini"
  const scroller = useRef<HTMLDivElement | null>(null)
  const settled = useRef(false)
  const [scrolledUp, setScrolledUp] = useState(false)

  const visible = mini ? entries.slice(-MINI_LIMIT) : entries
  const hidden = entries.length - visible.length
  const rows = toRows(visible)
  const lastId = entries[entries.length - 1]?.id
  const hasWorking = Boolean(working)

  const setScroller = useCallback(
    (node: HTMLDivElement | null) => {
      scroller.current = node
      assignRef(scrollRef, node)
    },
    [scrollRef],
  )

  useEffect(() => {
    const node = scroller.current
    if (!node || mini || scrolledUp) return
    node.scrollTo({ top: node.scrollHeight, behavior: reduced || !settled.current ? "auto" : "smooth" })
    settled.current = true
  }, [lastId, writing, hasWorking, mini, scrolledUp, reduced])

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const node = e.currentTarget
    const away = node.scrollHeight - node.scrollTop - node.clientHeight > JUMP_THRESHOLD_PX
    setScrolledUp((was) => (was === away ? was : away))
  }

  const jump = () => {
    const node = scroller.current
    if (!node) return
    node.scrollTo({ top: node.scrollHeight, behavior: reduced ? "auto" : "smooth" })
    setScrolledUp(false)
  }

  const enter = reduced
    ? { initial: false as const, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: BUBBLE_ENTER.y, scale: BUBBLE_ENTER.scale },
        animate: { opacity: 1, y: 0, scale: 1 },
      }
  const motionTransition = reduced ? { duration: 0 } : { duration: DUR.bubble, ease: EASE_OUT }

  const list = (
    <div
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label={copy.timbl.transcriptLabel}
      data-figma="Transcript/log"
      className={tw("flex flex-col", !mini && "flex-1 justify-end")}
    >
      <ol className="flex flex-col">
        <AnimatePresence initial={false}>
          {rows.map((row) => (
            <motion.li
              key={row.entry.id}
              layout={reduced ? false : "position"}
              initial={enter.initial}
              animate={enter.animate}
              transition={motionTransition}
              className={rowSpacing(row, mini)}
            >
              {row.kind === "divider" ? (
                <DividerRow entry={row.entry} />
              ) : (
                <MessageRow
                  row={row}
                  mini={mini}
                  touch={touch}
                  assistantName={assistantName}
                  assistantAvatar={assistantAvatar}
                  renderAttachment={renderAttachment}
                  onViewCard={onViewCard}
                />
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  )

  const waiting = working ? (
    <div data-figma="Transcript/working" className={tw("flex items-center", mini ? "mt-2" : "mt-4")}>
      {working}
    </div>
  ) : writing ? (
    <p aria-hidden="true" data-figma="Transcript/writing" className={tw("text-caption text-muted-foreground", mini ? "mt-2" : "mt-4")}>
      {copy.timbl.writing}
    </p>
  ) : null

  if (mini) {
    return (
      <div data-slot="agentic-transcript" data-state="mini" data-figma="Transcript/root" className="flex flex-col gap-2">
        {hidden > 0 && (
          <Button
            type="button"
            variant="link"
            size="xs"
            onClick={onShowEarlier}
            data-figma="Transcript/earlier"
            className={tw("self-start px-0", touch && TOUCH.control)}
          >
            {copy.flyout.earlier(hidden)}
          </Button>
        )}
        {list}
        {waiting}
      </div>
    )
  }

  return (
    <div data-slot="agentic-transcript" data-state={scrolledUp ? "scrolled" : "latest"} data-figma="Transcript/root" className="relative flex min-h-0 flex-1 flex-col">
      <div ref={setScroller} onScroll={onScroll} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-4 pb-2">
        {list}
        {waiting}
      </div>
      {scrolledUp && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={jump}
            data-figma="Transcript/jump"
            className={tw("pointer-events-auto rounded-full", touch && TOUCH.control)}
          >
            <ArrowDown aria-hidden="true" />
            {copy.timbl.jumpLatest}
          </Button>
        </div>
      )}
    </div>
  )
}

function rowSpacing(row: Row, mini: boolean): string {
  if (row.kind === "divider") return mini ? "mt-3 first:mt-0" : "mt-6 first:mt-0"
  if (row.first) return mini ? "mt-3 first:mt-0" : "mt-4 first:mt-0"
  return "mt-1"
}

function DividerRow({ entry }: { entry: TranscriptEntry }) {
  const { copy } = usePrototype()
  const label = entry.divider === "handoff" ? copy.timbl.dividerHandoff : entry.divider === "new_chat" ? copy.timbl.dividerNewChat : (entry.text ?? "")
  return (
    <div data-figma="Transcript/divider" className="flex items-center gap-3">
      <Separator className="flex-1" />
      <span className="shrink-0 text-caption text-muted-foreground">{label}</span>
      <Separator className="flex-1" />
    </div>
  )
}

function MessageRow({
  row,
  mini,
  touch,
  assistantName,
  assistantAvatar,
  renderAttachment,
  onViewCard,
}: {
  row: Extract<Row, { kind: "message" }>
  mini: boolean
  touch: boolean
  assistantName: string
  assistantAvatar: React.ReactNode
  renderAttachment: TranscriptProps["renderAttachment"]
  onViewCard?: (card: CanvasCard) => void
}) {
  const { copy } = usePrototype()
  const { entry, sender, first, last } = row
  const textClass = mini ? "text-body-sm" : "text-body-md"
  const body = entry.rich?.length ? (
    <RichSpans spans={entry.rich} className={textClass} />
  ) : (
    <RichText text={entry.text ?? ""} className={textClass} />
  )
  const attachments = entry.attachments ?? []

  const bubble =
    sender === "user" ? (
      <div className="flex flex-col items-end gap-1 pl-8 @3xl:pl-0">
        <ClampedBubble
          entryId={entry.id}
          mini={mini}
          figma="Transcript/user-bubble"
          className={tw(
            "w-fit max-w-full bg-primary px-4 py-2.5 text-primary-foreground @3xl:max-w-sm",
            bubbleCorners("user", first),
          )}
        >
          {body}
        </ClampedBubble>
        {entry.source === "voice" && (
          <span className="flex items-center gap-1 text-caption text-muted-foreground">
            <AudioLines aria-hidden="true" className="size-3.5" />
            {copy.timbl.voiceBadge}
          </span>
        )}
        {entry.queued && <span className="text-caption text-muted-foreground">{copy.timbl.queuedNote}</span>}
      </div>
    ) : (
      <div className="flex flex-col gap-1 pr-8 @3xl:pr-0">
        {first && <span className="pl-8 text-caption text-muted-foreground">{assistantName}</span>}
        <div className="flex items-end gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center">{last ? assistantAvatar : null}</span>
          <ClampedBubble
            entryId={entry.id}
            mini={mini}
            figma="Transcript/assistant-bubble"
            className={tw(
              "w-fit max-w-full bg-muted px-4 py-2.5 text-foreground dark:ring-1 dark:ring-foreground/10 @3xl:max-w-md",
              bubbleCorners("assistant", first),
            )}
          >
            {body}
          </ClampedBubble>
        </div>
      </div>
    )

  return (
    <>
      {bubble}
      {attachments.length > 0 && (
        <div aria-live="off" data-figma="Transcript/attachments" className="mt-3 flex flex-col gap-3">
          {attachments.map((attachment, index) => (
            <div key={`${attachment.kind}-${index}`} className="w-full">
              {attachment.kind === "card_link" ? (
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={() => onViewCard?.(attachment.card)}
                  data-figma="Transcript/card-link"
                  className={tw("px-0", touch && TOUCH.control, sender === "assistant" && "ml-8")}
                >
                  {copy.timbl.viewOnCanvas}
                </Button>
              ) : (
                renderAttachment(attachment, entry)
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function ClampedBubble({
  entryId,
  mini,
  figma,
  className,
  children,
}: {
  entryId: string
  mini: boolean
  figma: string
  className: string
  children: React.ReactNode
}) {
  const { copy, disclosure, setDisclosure } = usePrototype()
  const bodyId = useId()
  const content = useRef<HTMLDivElement | null>(null)
  const [overflows, setOverflows] = useState(false)
  const key = `transcript-mini-${entryId}`
  const open = Boolean(disclosure[key])

  useEffect(() => {
    const node = content.current
    if (!mini || !node) return
    const measure = () => {
      const clamped = node.scrollHeight > node.clientHeight + 1
      setOverflows((was) => (open ? was : clamped))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [mini, open])

  return (
    <div data-figma={figma} className={tw(className, "flex flex-col gap-1")}>
      <div id={bodyId} ref={content} className={mini && !open ? "line-clamp-3" : undefined}>
        {children}
      </div>
      {mini && (overflows || open) && (
        <DisclosureTrigger
          open={open}
          onOpenChange={(next) => setDisclosure(key, next)}
          controls={bodyId}
          className="w-fit rounded-md"
          chevronClassName="text-current"
        >
          <span className="text-caption">{open ? copy.cards.shell.showLess : copy.cards.shell.showMore}</span>
        </DisclosureTrigger>
      )}
    </div>
  )
}
