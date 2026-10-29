"use client"

import { useId, type ReactNode } from "react"

import { DisclosureBody, DisclosureTrigger, useRemembered } from "@/components/ui/disclosure"

export { useRemembered }

type Props = {
  id: string
  title: string
  count?: number
  summary?: ReactNode
  action?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}

export function Section({ id, title, count, summary, action, defaultOpen = true, children, className }: Props) {
  const [open, setOpen] = useRemembered(id, defaultOpen)
  const bodyId = useId()

  return (
    <section aria-label={title} className={className}>
      <div className="flex min-h-9 items-center gap-3">
        <DisclosureTrigger
          open={open}
          onOpenChange={setOpen}
          controls={bodyId}
          heading={2}
          className="-ml-1.5 min-w-0 flex-1 rounded-md px-1.5 py-1"
        >
          <span className="text-[15px] font-semibold text-foreground">{title}</span>
          {count != null && <span className="text-[13px] tabular-nums text-muted-foreground">{count}</span>}
          {summary && !open && (
            <span className="min-w-0 truncate text-[13px] text-muted-foreground">
              <span aria-hidden className="mx-1">·</span>
              {summary}
            </span>
          )}
        </DisclosureTrigger>
        {action && open && <div className="shrink-0">{action}</div>}
      </div>
      <DisclosureBody id={bodyId} open={open} className="pt-3">
        {children}
      </DisclosureBody>
    </section>
  )
}
