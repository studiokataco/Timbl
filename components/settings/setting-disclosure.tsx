"use client"

import { useId, useState } from "react"

import { DisclosureBody, DisclosureTrigger } from "@/components/ui/disclosure"
import { cn } from "@/lib/utils"

type Props = {
  title: string
  summary: string
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
  const bodyId = useId()

  return (
    <section className={cn("rounded-lg border border-border bg-background", className)}>
      <DisclosureTrigger
        open={open}
        onOpenChange={setOpen}
        controls={bodyId}
        className="gap-3 rounded-lg px-4 py-3 hover:bg-secondary/40"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">{title}</span>
          {!open && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {summary}
            </span>
          )}
        </span>
      </DisclosureTrigger>
      <DisclosureBody id={bodyId} open={open} className="px-4 pb-4 pt-1">
        {children}
      </DisclosureBody>
    </section>
  )
}
