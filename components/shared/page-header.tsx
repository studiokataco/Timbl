"use client"

import { useRef, type ReactNode } from "react"
import { useHeadingReveal } from "./motion-cal"
import { cn } from "@/lib/utils"

type Props = {
  title: ReactNode
  description?: ReactNode
  /** Right-aligned slot — typically a button (e.g. "Manage" on /campaigns). */
  action?: ReactNode
  /** Optional override for the title scale. Defaults to display-md (Cal-marketing voice). */
  size?: "md" | "sm"
  className?: string
}

/*
 * Shared page header. Display-scale title + body-md description, with a
 * GSAP-driven enter reveal honoured by `useHeadingReveal`. Used app-wide so
 * every page reads with the same Cal voice — generous breathing room,
 * negative tracking on the heading, optional right-aligned action.
 */
export function PageHeader({
  title,
  description,
  action,
  size = "md",
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useHeadingReveal(ref)
  const titleClass =
    size === "md"
      ? "text-display-sm md:text-display-md text-foreground"
      : "text-display-sm text-foreground"

  return (
    <div
      ref={ref}
      className={cn("flex items-end justify-between gap-6", className)}
    >
      <div className="space-y-3 min-w-0">
        <h1 data-cal-heading className={titleClass}>
          {title}
        </h1>
        {description && (
          <p
            data-cal-description
            className="text-body-md text-muted-foreground max-w-2xl"
          >
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
