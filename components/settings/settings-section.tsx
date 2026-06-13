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
        "grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-12",
        !isFirst && "border-t border-border mt-10 pt-10",
        className,
      )}
    >
      <div className="lg:col-span-4 lg:max-w-xs">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {action && <div className="shrink-0 lg:hidden">{action}</div>}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
        {action && <div className="hidden lg:block mt-4">{action}</div>}
      </div>
      <div className="lg:col-span-8 min-w-0">{children}</div>
    </section>
  )
}
