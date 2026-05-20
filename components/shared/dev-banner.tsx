import { getCurrentOrganisation, getCurrentUser } from "@/lib/auth/server-helpers"

/*
 * Visible only in emulator mode (NEXT_PUBLIC_USE_EMULATORS=1). Reminds the
 * developer the dev shim is providing identity instead of real Firebase
 * Auth, and names the org the SAFE-demo-mode toggle currently resolves to
 * (Settings → Workspace). Renders nothing in production.
 */
export async function DevBanner() {
  if (process.env.NEXT_PUBLIC_USE_EMULATORS !== "1") return null

  const [user, org] = await Promise.all([
    getCurrentUser(),
    getCurrentOrganisation(),
  ])

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-border bg-secondary text-muted-foreground text-xs px-4 py-1.5 flex items-center justify-center gap-2"
    >
      <span aria-hidden>🛠</span>
      <span>
        Emulator mode — auto-signed in as <strong>{user.name}</strong> @{" "}
        {org.name}
      </span>
    </div>
  )
}
