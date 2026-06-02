"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { toast } from "sonner"

import { useDialogs } from "@/components/shared/dialogs-provider"
import { getReminderSettings } from "@/lib/actions/reminder-settings"
import {
  getWorkspaceReminders,
  type WorkspaceReminder,
} from "@/lib/actions/reminders"

const SHOWN_SESSION_KEY = "workspace-reminders:shown"
const SHOWN_DAY_KEY = "workspace-reminders:shown-day"

function storageKey(frequency: "per-session" | "once-per-day"): string {
  if (frequency === "once-per-day") {
    return `${SHOWN_DAY_KEY}:${format(new Date(), "yyyy-MM-dd")}`
  }
  return SHOWN_SESSION_KEY
}

function readShown(key: string): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    return new Set(
      Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [],
    )
  } catch {
    return new Set()
  }
}

function markShown(key: string, ids: string[]) {
  const next = new Set([...readShown(key), ...ids])
  try {
    window.sessionStorage.setItem(key, JSON.stringify([...next]))
  } catch {
    /* quota */
  }
}

function actionLabel(reminder: WorkspaceReminder): string {
  switch (reminder.kind) {
    case "approval-due":
      return "Review drafts"
    case "overdue":
      return "Open post"
    case "goes-live-soon":
      return "Final check"
    case "silent-category":
      return "Plan a post"
  }
}

export function WorkspaceReminders() {
  const router = useRouter()
  const { openComposer, openQuickAdd } = useDialogs()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    void getReminderSettings().then((settings) => {
      if (!settings.enabled) return
      return getWorkspaceReminders(settings).then((reminders) => {
        const key = storageKey(settings.frequency)
        const shown = readShown(key)
        const pending = reminders
          .filter((r) => !shown.has(r.id))
          .slice(0, settings.maxToastsPerSession)
        if (pending.length === 0) return

        const onAction = (reminder: WorkspaceReminder) => {
          switch (reminder.kind) {
            case "approval-due":
              router.push("/kanban")
              break
            case "overdue":
            case "goes-live-soon":
              void openComposer(reminder.postId)
              break
            case "silent-category":
              openQuickAdd({ initialCategoryId: reminder.categoryId })
              break
          }
        }

        for (const reminder of pending) {
          toast(reminder.title, {
            description: reminder.description,
            action: {
              label: actionLabel(reminder),
              onClick: () => onAction(reminder),
            },
          })
        }
        markShown(key, pending.map((r) => r.id))
      })
    })
  }, [openComposer, openQuickAdd, router])

  return null
}
