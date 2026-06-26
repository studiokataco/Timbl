import { forwardRef } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export interface RolePillProps extends React.ComponentPropsWithoutRef<"span"> {
  label: string
  /* A tonal class pair, e.g. "bg-sky-500/15 text-sky-700 dark:text-sky-400". */
  tone: string
  icon?: LucideIcon
}

/* Shared role/status chip used by both the platform control centre and the
 * tenant workspace team pages. Forwards ref and props so it can back a
 * tooltip or other trigger. */
export const RolePill = forwardRef<HTMLSpanElement, RolePillProps>(
  function RolePill({ label, tone, icon: Icon, className, ...props }, ref) {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
          tone,
          className,
        )}
        {...props}
      >
        {Icon ? <Icon className="size-3" /> : null}
        {label}
      </span>
    )
  },
)
