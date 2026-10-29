"use client"

import { useEffect, useState, useTransition } from "react"
import { Calendar, Compass, KanbanSquare, Sparkles } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  fetchCurrentUserPreferences,
  updateCurrentUserPreferences,
} from "@/lib/actions/user"
import { startProductTour } from "@/components/tour/product-tour"

/*
 * First-load welcome flashcards. Three steps:
 *   1. Calendar overview
 *   2. Quick add / composer
 *   3. Other views + CTA = "Take the tour" (driver.js) or "Skip"
 *
 * Non-dismissable: outside-click and Escape are intercepted; the only
 * exits are the Skip button on step 3, the Take-the-tour button (which
 * launches the driver.js product tour), or pressing Next through to
 * step 3 and then Skip / Take the tour.
 *
 * Reopen any time with Shift+Alt+?  (also Shift+Opt+? on macOS), and
 * via the command palette. Shows once per user; re-running the setup
 * wizard clears the user's onboarded flag so the welcome plays again.
 */

const STEPS = [
  {
    icon: Sparkles,
    title: "Welcome to Timbl",
    body: "Calendar is your home base: scheduled and in-progress posts in one place. Edits save instantly for everyone in this workspace.",
  },
  {
    icon: Calendar,
    title: "Capture a post in seconds",
    body: "Click a day on Calendar or Quick add in the top bar, then pick date, category, and a brief. Category defaults fill hashtags, post type, and lead so you can save now and open the composer when you need more detail.",
  },
  {
    icon: KanbanSquare,
    title: "Switch views when you need them",
    body: "Drag posts on Kanban through your workflow columns. Use Templates for recurring posts, Awareness days for observances, and Campaigns to group related posts. Open Studio for AI agents, or press ⌘K to search and jump anywhere.",
  },
] as const

const REOPEN_EVENT = "welcome:open"

export function dispatchWelcomeOpen(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(REOPEN_EVENT))
}

export function Onboarding() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    fetchCurrentUserPreferences()
      .then(({ onboarded }) => {
        if (!cancelled && !onboarded) setOpen(true)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  /* Shift+Alt+?  reopens welcome from anywhere. Also handles
   * Shift+Alt+/ which is what most keyboards emit when Shift is held
   * over the ? key. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.shiftKey || !e.altKey) return
      if (e.key === "?" || e.key === "/") {
        e.preventDefault()
        setStep(0)
        setOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  /* Command-palette / button-driven open. */
  useEffect(() => {
    const onOpen = () => {
      setStep(0)
      setOpen(true)
    }
    window.addEventListener(REOPEN_EVENT, onOpen)
    return () => window.removeEventListener(REOPEN_EVENT, onOpen)
  }, [])

  const markOnboarded = () => {
    startTransition(async () => {
      await updateCurrentUserPreferences({ onboarded: true })
    })
  }

  const skipAll = () => {
    setOpen(false)
    markOnboarded()
  }

  const takeTour = () => {
    setOpen(false)
    markOnboarded()
    /* Wait for the dialog backdrop to unmount before the driver.js
     * spotlight tries to highlight a sidebar link underneath. */
    window.setTimeout(() => startProductTour(), 250)
  }

  const current = STEPS[step]
  if (!current) return null
  const Icon = current.icon
  const isLast = step === STEPS.length - 1

  return (
    <Dialog
      open={open}
      /* Non-dismissable: disablePointerDismissal blocks outside-click on
       * the base-ui Root; the onOpenChange swallow catches the Escape
       * path the primitive routes through (open=false is just ignored). */
      disablePointerDismissal
      onOpenChange={(o) => {
        if (o) setOpen(true)
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader className="space-y-3">
          <div
            aria-hidden
            className="size-10 rounded-full bg-secondary flex items-center justify-center text-foreground"
          >
            <Icon className="size-5" />
          </div>
          <DialogTitle className="text-base">{current.title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {current.body}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-1.5 py-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              aria-hidden
              className={
                i === step
                  ? "size-1.5 rounded-full bg-foreground"
                  : "size-1.5 rounded-full bg-muted-foreground/30"
              }
            />
          ))}
        </div>

        <DialogFooter>
          {step > 0 ? (
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Back
            </Button>
          ) : null}
          {isLast ? (
            <>
              <Button variant="ghost" onClick={skipAll}>
                Skip
              </Button>
              <Button onClick={takeTour}>
                <Compass className="size-4" />
                Take the tour
              </Button>
            </>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)}>
              Next ({step + 1}/{STEPS.length})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
