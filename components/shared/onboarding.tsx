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
    title: "Welcome to your social planner",
    body: "This replaces the old 9-tab spreadsheet with one calendar-first view of every post in flight. Your data syncs in real time across devices.",
  },
  {
    icon: Calendar,
    title: "Quick add takes 30 seconds",
    body: "Click any day on the calendar (or hit the Quick add button up top) to drop a post in three taps: date, category, brief. Categories carry your defaults — hashtags, post type, lead — so the rest is autofilled.",
  },
  {
    icon: KanbanSquare,
    title: "Track work the way you think",
    body: "Switch to Kanban to drag posts through idea → designing → scheduled. Use the Library for templates and Awareness days for never missing an observance again. Press ⌘K from anywhere to jump.",
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
