"use client"

import { useEffect, useRef, useSyncExternalStore, type ComponentProps, type ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

const STORAGE_PREFIX = "timbl.studio.section."
const EVENT = "timbl:studio-section"
const EASE = [0.22, 1, 0.36, 1] as const

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb)
  window.addEventListener(EVENT, cb)
  return () => {
    window.removeEventListener("storage", cb)
    window.removeEventListener(EVENT, cb)
  }
}

export function setRemembered(key: string, v: boolean) {
  window.localStorage.setItem(STORAGE_PREFIX + key, v ? "1" : "0")
  window.dispatchEvent(new Event(EVENT))
}

export function useRemembered(key: string, fallback: boolean) {
  const saved = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(STORAGE_PREFIX + key),
    () => null,
  )
  const open = saved == null ? fallback : saved === "1"
  const set = (v: boolean) => setRemembered(key, v)
  return [open, set] as const
}

export function DisclosureChevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <ChevronDown
      aria-hidden
      className={cn(
        "size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-foreground motion-reduce:transition-none",
        !open && "-rotate-90",
        className,
      )}
    />
  )
}

type TriggerProps = Omit<ComponentProps<"button">, "onClick" | "type"> & {
  open: boolean
  onOpenChange: (open: boolean) => void
  controls: string
  chevronClassName?: string
  heading?: 2 | 3 | 4
}

export function DisclosureTrigger({ open, onOpenChange, controls, chevronClassName, heading, className, children, ...rest }: TriggerProps) {
  const button = (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={() => onOpenChange(!open)}
      className={cn(
        "group flex w-full items-center gap-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        className,
      )}
      {...rest}
    >
      <DisclosureChevron open={open} className={chevronClassName} />
      {children}
    </button>
  )
  if (!heading) return button
  const Heading = `h${heading}` as const
  return <Heading className="contents">{button}</Heading>
}

export function DisclosureBody({ id, open, className, children }: { id: string; open: boolean; className?: string; children: ReactNode }) {
  const reduced = useReducedMotion()
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          id={id}
          initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, height: "auto" }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
          transition={{ duration: 0.22, ease: EASE }}
          className="overflow-hidden"
        >
          <div className={className}>{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

type ShowMoreProps = {
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  hiddenCount: number
  noun?: string
  controls?: string
  focusTarget?: () => HTMLElement | null | undefined
  className?: string
}

export function ShowMore({ expanded, onExpandedChange, hiddenCount, noun, controls, focusTarget, className }: ShowMoreProps) {
  const pending = useRef(false)
  useEffect(() => {
    if (expanded && pending.current) {
      pending.current = false
      focusTarget?.()?.focus({ preventScroll: false })
    }
  }, [expanded, focusTarget])

  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={() => {
        pending.current = !expanded
        onExpandedChange(!expanded)
      }}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-md text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {expanded ? "Show less" : `Show ${hiddenCount} more${noun ? ` ${noun}` : ""}`}
      <ChevronDown
        aria-hidden
        className={cn("size-3.5 transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-180")}
      />
    </button>
  )
}
