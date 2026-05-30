import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  icon: LucideIcon
  title: string
  body?: React.ReactNode
  action?: React.ReactNode
  className?: string
  size?: "sm" | "md" | "lg"
}

/*
 * Designed empty state - used across every data view. Lucide icon, headline,
 * sub-line, and optional primary action. Replaces ad-hoc "No data" strings
 * with one consistent shape (see DESIGN.md §empty-states).
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
  size = "md",
}: Props) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-lg border border-dashed border-border bg-secondary/20 flex flex-col items-center text-center gap-2",
        size === "sm" && "p-6",
        size === "md" && "p-10",
        size === "lg" && "p-14",
        className,
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          "text-muted-foreground/60",
          size === "sm" && "size-6",
          size === "md" && "size-8",
          size === "lg" && "size-10",
        )}
      />
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      {body && (
        <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
          {body}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
