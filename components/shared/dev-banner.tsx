import { DEV_SESSION } from "@/lib/auth/dev-session"

/*
 * Visible only in emulator mode (NEXT_PUBLIC_USE_EMULATORS=1). Reminds the
 * developer the dev shim is providing identity instead of real Firebase
 * Auth. Renders nothing in production.
 */
export function DevBanner() {
  if (process.env.NEXT_PUBLIC_USE_EMULATORS !== "1") return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-border bg-secondary text-muted-foreground text-xs px-4 py-1.5 flex items-center justify-center gap-2"
    >
      <span aria-hidden>🛠</span>
      <span>
        Emulator mode — auto-signed in as <strong>{DEV_SESSION.user.name}</strong> @{" "}
        {DEV_SESSION.organisation.name}
      </span>
    </div>
  )
}
