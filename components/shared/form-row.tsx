import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function FormRow({
  title,
  hint,
  htmlFor,
  children,
  className,
}: {
  title: string
  hint?: ReactNode
  htmlFor?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("@container border-b border-border py-6 first:pt-2 last:border-b-0", className)}>
      <div className="grid gap-3 @xl:grid-cols-[220px_minmax(0,1fr)] @xl:gap-10">
        <div>
          {htmlFor ? (
            <label htmlFor={htmlFor} className="text-[14px] font-semibold text-foreground">
              {title}
            </label>
          ) : (
            <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
          )}
          {hint ? <p className="mt-1 max-w-[32ch] text-[13px] leading-snug text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  )
}

export function FormGroupTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("pt-10 text-[15px] font-semibold text-foreground", className)}>{children}</h2>
}
