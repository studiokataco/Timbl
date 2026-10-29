import { cn } from "@/lib/utils"

type Props = {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  isFirst?: boolean
  className?: string
}

export function SettingsSection({ title, description, action, children, isFirst = false, className }: Props) {
  return (
    <section className={cn("@container border-b border-border py-8 last:border-b-0", isFirst && "pt-2", className)}>
      <div className="grid gap-4 @xl:grid-cols-[220px_minmax(0,1fr)] @xl:gap-10">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[14px] font-semibold text-foreground">{title}</h2>
            {action && <div className="shrink-0 @xl:hidden">{action}</div>}
          </div>
          {description && (
            <p className="mt-1 max-w-[32ch] text-[13px] leading-snug text-muted-foreground">{description}</p>
          )}
          {action && <div className="mt-4 hidden @xl:block">{action}</div>}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  )
}
