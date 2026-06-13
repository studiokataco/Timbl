import { cn } from "@/lib/utils"

type Props = {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  isFirst?: boolean
  className?: string
}

export function SettingsSection({
  title,
  description,
  action,
  children,
  isFirst = false,
  className,
}: Props) {
  return (
    <section
      className={cn(
        !isFirst && "border-t border-border mt-10 pt-10",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  )
}
