"use client"

import { useEffect, useState, useTransition } from "react"
import { Calendar, KanbanSquare, Sparkles } from "lucide-react"
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

/*
 * First-load welcome dialog. Three steps. The "onboarded" flag persists in
 * users.{userId}.preferences so it doesn't re-show on every reload.
 *
 * Mounted globally in (app)/layout.tsx; checks preferences once on mount and
 * opens itself if the user hasn't dismissed before.
 */

const STEPS = [
  {
    icon: Sparkles,
    title: "Welcome to SAFE Planner",
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
]

export function Onboarding() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    void fetchCurrentUserPreferences().then(({ onboarded }) => {
      if (!cancelled && !onboarded) setOpen(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const finish = () => {
    setOpen(false)
    startTransition(async () => {
      await updateCurrentUserPreferences({ onboarded: true })
    })
  }

  const current = STEPS[step]
  if (!current) return null
  const Icon = current.icon
  const isLast = step === STEPS.length - 1

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) finish()
        else setOpen(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
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
          <Button variant="ghost" onClick={finish}>
            Skip
          </Button>
          {isLast ? (
            <Button onClick={finish}>Get started</Button>
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
