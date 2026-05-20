/*
 * Welcome shell — the dev-only workspace chooser at /welcome. Lives in its
 * own route group, OUTSIDE (app), so it carries no sidebar / top bar and
 * the first-launch onboarding redirect can't reach it. Mirrors the
 * centered card layout of (auth).
 */
export default function WelcomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen w-full grid place-items-center bg-background text-foreground p-6">
      <div className="w-full max-w-2xl">{children}</div>
    </main>
  )
}
