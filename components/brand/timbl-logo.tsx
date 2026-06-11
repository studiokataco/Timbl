import { cn } from "@/lib/utils"

export function TimblLogo({
  className,
  size = 32,
}: {
  className?: string
  size?: number
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <rect width="32" height="32" rx="7" fill="#090A12" />
      <rect x="7" y="7" width="4" height="7" rx="1.2" fill="#00E89A" />
      <rect x="14" y="7" width="4" height="7" rx="1.2" fill="#161624" />
      <rect x="21" y="7" width="4" height="7" rx="1.2" fill="#FF5040" />
      <rect x="7" y="18" width="4" height="7" rx="1.2" fill="#161624" />
      <rect x="14" y="18" width="4" height="7" rx="1.2" fill="#7B5EFF" />
      <rect x="21" y="18" width="4" height="7" rx="1.2" fill="#161624" />
    </svg>
  )
}

export function TimblWordmark({
  className,
  logoSize = 28,
  href,
}: {
  className?: string
  logoSize?: number
  href?: string
}) {
  const inner = (
    <>
      <TimblLogo size={logoSize} />
      <span className="text-base font-semibold tracking-tight leading-none">
        timbl
      </span>
    </>
  )

  const classes = cn("inline-flex items-center gap-2.5", className)

  if (href) {
    return (
      <a href={href} className={classes} aria-label="Timbl home">
        {inner}
      </a>
    )
  }

  return <div className={classes}>{inner}</div>
}
