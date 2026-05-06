import { DEV_SESSION } from "@/lib/auth/dev-session"

/*
 * Visible only outside production builds. A constant reminder that real auth
 * isn't wired yet and that every Firestore call is going to the emulator (or
 * silently failing if the emulator isn't running).
 *
 * Phase 7 removes this component.
 */
export function DevBanner() {
  if (process.env.NODE_ENV === "production") return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-border bg-secondary text-muted-foreground text-xs px-4 py-1.5 flex items-center justify-center gap-2"
    >
      <span aria-hidden>🛠</span>
      <span>
        Dev mode — auto-signed in as <strong>{DEV_SESSION.user.name}</strong> @{" "}
        {DEV_SESSION.organisation.name}
      </span>
    </div>
  )
}
