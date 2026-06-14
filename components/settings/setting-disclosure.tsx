"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

type Props = {
  title: string
  summary?: string
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
}

export function SettingDisclosure({
  title,
  summary,
  defaultOpen = false,
  children,
  className,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className={cn("rounded-lg border border-border bg-background", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
      >
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            !open && "-rotate-90",
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">{title}</span>
          {!open && summary && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {summary}
            </span>
          )}
        </span>
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </section>
  )
}
