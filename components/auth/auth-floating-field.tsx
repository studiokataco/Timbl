"use client"

import type { LucideIcon } from "lucide-react"
import type { FieldError } from "react-hook-form"

import { cn } from "@/lib/utils"

export function AuthFloatingField({
  id,
  label,
  icon: Icon,
  type = "text",
  error,
  className,
  ...props
}: React.ComponentProps<"input"> & {
  id: string
  label: string
  icon: LucideIcon
  error?: FieldError
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <Icon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id={id}
          type={type}
          className={cn(
            "flex h-11 w-full rounded-lg border border-border bg-[var(--auth-field)] px-3 pl-10 text-sm text-foreground",
            "placeholder:text-muted-foreground focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/25",
            error &&
              "border-destructive focus:border-destructive focus:ring-destructive/25",
            className,
          )}
          {...props}
        />
      </div>
      {error?.message ? (
        <p className="text-xs text-destructive">{error.message}</p>
      ) : null}
    </div>
  )
}
