import { cn } from "@/lib/utils"

export function AuthCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 bg-card/45 p-8 shadow-2xl backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  )
}
