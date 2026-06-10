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
  ...props
}: React.ComponentProps<"input"> & {
  id: string
  label: string
  icon: LucideIcon
  error?: FieldError
}) {
  return (
    <div className="relative z-0">
      <input
        id={id}
        type={type}
        placeholder=" "
        className={cn(
          "peer block w-full appearance-none border-0 border-b-2 border-border bg-transparent px-0 py-2.5 text-sm text-foreground focus:border-brand-accent focus:outline-none focus:ring-0",
          error && "border-destructive focus:border-destructive",
        )}
        {...props}
      />
      <label
        htmlFor={id}
        className="absolute top-3 -z-10 origin-[0] -translate-y-6 scale-75 text-sm text-muted-foreground duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:text-brand-accent"
      >
        <Icon className="-mt-1 mr-2 inline-block" size={16} />
        {label}
      </label>
      {error?.message ? (
        <p className="mt-1 text-xs text-destructive">{error.message}</p>
      ) : null}
    </div>
  )
}
