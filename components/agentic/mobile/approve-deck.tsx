"use client"

import { useEffect, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, CircleCheck, LoaderCircle, Mic, ShieldCheck, TriangleAlert, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatWhen } from "../clock"
import { DUR, EASE_IN, EASE_OUT, primaryChannel, tw } from "../lib"
import { ChannelMark } from "../primitives/channel-mark"
import { PreviewTile } from "../primitives/preview-tile"
import { useAgenticMotion, usePrototype } from "../prototype-context"
import type { ApproveDeckEntry, DeckDecision, PrototypePost, RefineKind, UserRole } from "../types"

export type ApproveDeckProps = {
  entries: ApproveDeckEntry[]
  posts: Record<string, PrototypePost>
  index: number
  decisions: DeckDecision[]
  refining: { postId: string; kind: RefineKind } | null
  viewerRole: UserRole
  framed?: boolean
  onRefine: (kind: RefineKind) => void
  onApprove: () => void
  onSkip: () => void
  onMic: () => void
  onBack: () => void
  onReviewSkipped: () => void
  approveRef?: React.Ref<HTMLButtonElement>
  onKeyCommand: (key: "approve" | "skip") => void
}

const REFINE_KEYS: RefineKind[] = ["shorter", "funnier", "new_image"]

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"
}

export function ApproveDeck({
  entries,
  posts,
  index,
  decisions,
  refining,
  viewerRole,
  framed = true,
  onRefine,
  onApprove,
  onSkip,
  onMic,
  onBack,
  onReviewSkipped,
  approveRef,
  onKeyCommand,
}: ApproveDeckProps): React.JSX.Element {
  const { copy } = usePrototype()
  const { reduced } = useAgenticMotion()
  const d = copy.mobile.deck
  const doneTitleRef = useRef<HTMLHeadingElement | null>(null)

  const total = entries.length
  const currentEntry = entries[index]
  const currentPost = currentEntry ? posts[currentEntry.postId] : undefined
  const isDone = !currentEntry || !currentPost

  useEffect(() => {
    if (isDone) doneTitleRef.current?.focus()
  }, [isDone])

  const approvedCount = decisions.filter((x) => x.outcome === "approved" || x.outcome === "submitted").length
  const skippedCount = decisions.filter((x) => x.outcome === "skipped").length

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isDone || isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === "a" || e.key === "A") {
      e.preventDefault()
      onKeyCommand("approve")
    } else if (e.key === "x" || e.key === "X") {
      e.preventDefault()
      onKeyCommand("skip")
    }
  }

  const cardMotion = reduced
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: DUR.fade } },
        exit: { opacity: 0, transition: { duration: DUR.fade } },
      }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0, transition: { duration: DUR.enter, ease: EASE_OUT } },
        exit: { opacity: 0, transition: { duration: DUR.exit, ease: EASE_IN } },
      }

  const channel = currentPost ? primaryChannel(currentPost) : "instagram"

  return (
    <div
      data-slot="agentic-approve-deck"
      data-state={isDone ? "done" : refining ? "refining" : "reviewing"}
      data-figma="ApproveDeck/root"
      onKeyDown={onKeyDown}
      className={tw("flex min-h-full flex-col bg-muted px-6 pb-6 text-foreground", framed ? "pt-16" : "pt-6")}
    >
      <header className="flex items-center justify-between px-1">
        <Button type="button" variant="ghost" aria-label={d.back} onClick={onBack} className="size-11">
          <ArrowLeft className="size-4" aria-hidden />
        </Button>
        <h1 className="text-title-sm text-foreground">{d.heading}</h1>
        <span aria-hidden="true" className="text-caption text-muted-foreground tabular-nums">
          {isDone ? d.counter(total, total) : d.counter(Math.min(index + 1, total), total)}
        </span>
        <span role="status" className="sr-only">
          {isDone ? d.doneTitle : d.counterSr(Math.min(index + 1, total), total)}
        </span>
      </header>

      {isDone ? (
        <div
          data-figma="ApproveDeck/done"
          className="my-auto flex flex-col items-center gap-3 rounded-xl bg-card p-6 text-center ring-1 ring-foreground/10 dark:ring-foreground/20"
        >
          <CircleCheck className="size-4 text-success" aria-hidden />
          <h2 ref={doneTitleRef} tabIndex={-1} className="text-title-lg text-foreground outline-none">
            {d.doneTitle}
          </h2>
          <p className="text-body-sm text-muted-foreground">
            {viewerRole === "contributor" ? d.doneContributor(approvedCount) : d.doneBody(approvedCount, skippedCount)}
          </p>
          <div className="mt-2 flex w-full flex-col gap-2">
            <Button className="h-11 w-full" onClick={onBack}>
              {d.backToToday}
            </Button>
            {skippedCount > 0 ? (
              <Button variant="outline" className="h-11 w-full" onClick={onReviewSkipped}>
                {d.reviewSkipped}
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4 pt-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.article
              key={currentPost.id}
              data-figma="ApproveDeck/article"
              {...cardMotion}
              className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 dark:ring-foreground/20"
            >
              <PreviewTile
                size="md"
                tile={currentPost.tile}
                alt={d.mediaAlt(currentPost.tile.headline)}
              />
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <ChannelMark channel={channel} />
                  <span className="truncate text-caption text-muted-foreground">
                    {formatWhen(currentPost.scheduledDate, currentPost.scheduledTime ?? "09:00")}
                  </span>
                </div>
                <p className="text-body-sm text-foreground">{currentPost.blurb}</p>
                <div className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2">
                  {currentEntry.brandCheck.ok ? (
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  ) : (
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                  )}
                  <p className="text-caption text-foreground">
                    <span className="font-medium">{currentEntry.brandCheck.ok ? d.brandOk : d.brandWarn}:</span>{" "}
                    <span>{currentEntry.brandCheck.note}</span>
                  </p>
                </div>
              </div>
            </motion.article>
          </AnimatePresence>

          <div data-figma="ApproveDeck/refineRow" className="flex flex-wrap gap-2">
            {REFINE_KEYS.map((kind) => {
              const busy = refining?.postId === currentPost.id && refining.kind === kind
              return (
                <Button
                  key={kind}
                  type="button"
                  variant="outline"
                  aria-busy={busy || undefined}
                  disabled={Boolean(refining) && !busy}
                  onClick={() => onRefine(kind)}
                  className="h-11 rounded-lg px-4"
                >
                  {busy ? (
                    <>
                      <LoaderCircle
                        className="size-4 animate-spin in-data-reduced-motion:animate-none"
                        aria-hidden
                      />
                      <span>{d.refining}</span>
                    </>
                  ) : (
                    <span>{d.refine[kind]}</span>
                  )}
                </Button>
              )
            })}
          </div>

          <div data-figma="ApproveDeck/bottomBar" className="mt-auto flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              aria-label={d.skip}
              onClick={onSkip}
              className="size-14 shrink-0 rounded-xl"
            >
              <X className="size-4" aria-hidden />
            </Button>
            <Button
              ref={approveRef}
              type="button"
              onClick={onApprove}
              className="h-14 flex-1 rounded-xl"
            >
              <span className="text-body-md font-medium">
                {viewerRole === "contributor" ? d.submit : d.approve}
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              aria-label={d.speak}
              onClick={onMic}
              className="size-14 shrink-0 rounded-xl"
            >
              <Mic className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
