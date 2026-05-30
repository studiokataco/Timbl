import { NextResponse, type NextRequest } from "next/server"

/*
 * Edge proxy (Next 16's evolution of middleware.ts) - gates the app on
 * session-cookie presence. Real verification happens in
 * `lib/auth/session.ts` on Node-runtime server actions and route
 * handlers; this layer is a UX hint that redirects unauthenticated users
 * to /login instead of letting them see a server error.
 *
 * Local emulator mode (NEXT_PUBLIC_USE_EMULATORS=1) bypasses the gate
 * entirely - the dev shim in `lib/auth/dev-session.ts` provides identity.
 */

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/welcome",
  "/access-pending",
  "/auth/callback",
  "/auth/logout",
  "/auth/session",
  "/auth/activate-workspace",
]
// "/ingest/" is the PostHog reverse-proxy path (next.config rewrites it to the
// PostHog US hosts). It must bypass the auth gate - middleware runs before
// rewrites, so without this the analytics calls get redirected to /?next=...
// and never reach PostHog.
//
// "/__/auth/" and "/__/firebase/" are Firebase Auth same-origin handlers
// (next.config rewrites them to *.firebaseapp.com). Blocking them breaks
// Google sign-in/sign-up on production - the popup redirect lands on
// /__/auth/handler and must not be sent back to /.
const PUBLIC_PREFIXES = [
  "/_next/",
  "/ingest/",
  "/__/auth/",
  "/__/firebase/",
  "/api/agents/cron/",
  "/api/social/",
  "/api/publish/",
]
const SESSION_COOKIE = "__session"

export default function proxy(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_USE_EMULATORS === "1") return NextResponse.next()

  const { pathname } = req.nextUrl
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next()
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next()

  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value)
  if (hasSession) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = "/"
  url.searchParams.set("next", pathname + req.nextUrl.search)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    /* Match everything except static assets and the public icons. */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
