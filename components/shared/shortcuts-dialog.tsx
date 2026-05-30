"use client"

import { useEffect, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/*
 * Global `?` cheatsheet. Listens for `?` (and `Shift+/`) anywhere the
 * user isn't actively typing into a form field - same guard as the
 * command palette so the two don't conflict.
 *
 * Shortcuts here are mirrors of the actual bindings, not the source of
 * truth. If you wire a new shortcut, add it both in the originating
 * component AND here.
 */

interface ShortcutGroup {
  label: string
  items: { keys: string[]; label: string }[]
}

const GROUPS: ShortcutGroup[] = [
  {
    label: "Navigation",
    items: [
      { keys: ["⌘", "K"], label: "Open command palette" },
      { keys: ["/"], label: "Search" },
      { keys: ["⌘", "1"], label: "Calendar" },
      { keys: ["⌘", "2"], label: "All posts" },
      { keys: ["⌘", "3"], label: "Kanban" },
      { keys: ["⌘", "4"], label: "Library" },
      { keys: ["⌘", "5"], label: "Awareness days" },
      { keys: ["⌘", "6"], label: "Campaigns" },
      { keys: ["⌘", ","], label: "Settings" },
      { keys: ["⌘", "N"], label: "Quick add post" },
      { keys: ["⌘", "J"], label: "Ask AI" },
      { keys: ["⌘", "⇧", "J"], label: "Agent history drawer" },
      { keys: ["?"], label: "This cheatsheet" },
    ],
  },
  {
    label: "Composer",
    items: [
      { keys: ["⌘", "Enter"], label: "Save & close" },
      { keys: ["Esc"], label: "Close composer" },
    ],
  },
  {
    label: "Calendar",
    items: [
      { keys: ["←"], label: "Previous month" },
      { keys: ["→"], label: "Next month" },
      { keys: ["T"], label: "Jump to today" },
    ],
  },
  {
    label: "Approvals",
    items: [
      { keys: ["A"], label: "Approve focused item" },
      { keys: ["R"], label: "Reject focused item" },
      { keys: ["U"], label: "Undo last approval" },
    ],
  },
]

export function ShortcutsDialog() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      if (isTyping) return
      /* Plain `?` is Shift+/ on most layouts. Check both representations. */
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Press <kbd className="font-mono">?</kbd> from anywhere to open this
            list.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 sm:grid-cols-2">
          {GROUPS.map((group) => (
            <section key={group.label} className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h3>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-foreground">{item.label}</span>
                    <span className="flex items-center gap-1">
                      {item.keys.map((k) => (
                        <kbd
                          key={k}
                          className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
