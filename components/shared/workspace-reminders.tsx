"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { useDialogs } from "@/components/shared/dialogs-provider"
import {
  getWorkspaceReminders,
  type WorkspaceReminder,
} from "@/lib/actions/reminders"

const STORAGE_KEY = "workspace-reminders:shown"
const MAX_TOASTS = 3

function readShown(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [])
  } catch {
    return new Set()
  }
}

function markShown(ids: string[]) {
  const next = new Set([...readShown(), ...ids])
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
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

    void getWorkspaceReminders().then((reminders) => {
      const shown = readShown()
      const pending = reminders.filter((r) => !shown.has(r.id)).slice(0, MAX_TOASTS)
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
      markShown(pending.map((r) => r.id))
    })
  }, [openComposer, openQuickAdd, router])

  return null
}
