"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

export function ListPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("@container overflow-hidden rounded-xl border border-border bg-background", className)}>
      {children}
    </div>
  )
}

export function ListGroup({
  label,
  count,
  action,
  children,
}: {
  label?: ReactNode
  count?: number
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="border-border [&+&]:border-t">
      {label != null && (
        <div className="flex min-h-8 items-center justify-between gap-3 bg-secondary/40 px-4 py-1.5">
          <p className="text-[12px] font-medium text-muted-foreground">
            {label}
            {count != null && <span className="ml-1.5 tabular-nums">{count}</span>}
          </p>
          {action}
        </div>
      )}
      <ul className="divide-y divide-border">{children}</ul>
    </div>
  )
}

type RowTarget =
  | { href: string; onOpen?: never }
  | { onOpen: () => void; href?: never }
  | { href?: never; onOpen?: never }

export function ListRow({
  leading,
  title,
  badge,
  subtitle,
  meta,
  actions,
  openLabel,
  muted,
  className,
  ...target
}: {
  leading?: ReactNode
  title: ReactNode
  badge?: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  openLabel?: string
  muted?: boolean
  className?: string
} & RowTarget) {
  const openable = Boolean(target.href || target.onOpen)
  const overlayClass = "absolute inset-0 focus-visible:outline-none"

  return (
    <li
      className={cn(
        "group relative isolate flex items-center gap-3 px-3 py-2.5 transition-colors sm:px-4",
        openable && "hover:bg-secondary/40 has-[[data-row]:focus-visible]:bg-secondary/40",
        className,
      )}
    >
      {target.href ? (
        <Link data-row href={target.href} aria-label={openLabel} className={overlayClass} />
      ) : target.onOpen ? (
        <button data-row type="button" onClick={target.onOpen} aria-label={openLabel} className={overlayClass} />
      ) : null}

      {leading}

      <div className={cn("min-w-0 flex-1", openable && "pointer-events-none")}>
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("truncate text-[14px] font-medium", muted ? "text-muted-foreground" : "text-foreground")}>
            {title}
          </span>
          {badge}
        </div>
        {subtitle != null && <div className="truncate text-[13px] text-muted-foreground">{subtitle}</div>}
      </div>

      {meta != null && (
        <div
          className={cn(
            "hidden shrink-0 flex-col items-end gap-0.5 text-right text-[12px] text-muted-foreground @2xl:flex",
            openable && "pointer-events-none",
          )}
        >
          {meta}
        </div>
      )}

      {actions != null && <div className="relative z-10 flex shrink-0 items-center gap-1">{actions}</div>}

      {openable && (
        <ChevronRight
          aria-hidden
          className="pointer-events-none size-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 group-hover:translate-x-0.5"
        />
      )}
    </li>
  )
}

export function ListEmpty({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 px-4 py-6">
      <p className="text-[14px] font-medium text-foreground">{title}</p>
      {body && <p className="max-w-[60ch] text-[13px] text-muted-foreground">{body}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
