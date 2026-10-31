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
  "/signup",
  "/pricing",
  "/checkout",
  "/contact",
  "/shipping",
  "/refunds",
  "/privacy",
  "/terms",
  "/request-invite",
  "/claim-access",
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
  // Machine surfaces with their own bearer-token auth, plus OAuth discovery
  // which must be reachable unauthenticated per RFC 9728/8414. The session
  // cookie gate would 307 their clients into an HTML login page.
  "/api/public/",
  "/api/mcp",
  // Razorpay webhook - external POST, verified by HMAC signature in the
  // route itself. The cookie gate would 307 Razorpay's delivery to /login.
  "/api/webhooks/",
  "/.well-known/",
  // Public post share + client approval - token-scoped, no session required.
  "/p/",
]
const SESSION_COOKIE = "__session"

/* Internals the admin-host rewrite must never touch (framework, auth
 * handlers, analytics proxy, and the control APIs which are already
 * correctly pathed). Everything else on the admin host is a page route and
 * gets rewritten into the (control) group. */
const ADMIN_PASSTHROUGH_PREFIXES = [
  "/_next/",
  "/__/",
  "/ingest/",
  "/api/control/",
  "/control",
  /* Sign-out and the Firebase popup handlers must work on the admin host.
   * /login is NOT passed through - it rewrites into /control/login, the
   * dedicated platform-admin sign-in, separate from the tenant login. */
  "/auth/",
]

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  /* App Hosting's CDN hits Cloud Run on the tagged *.run.app URL and carries
   * the user-facing domain in X-Forwarded-Host - Host alone never equals
   * admin.<domain> in prod. Routing only; authz stays in requirePlatformAdmin. */
  const host = (
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    ""
  )
    .split(",")[0]
    .trim()
  const adminHost = process.env.NEXT_PUBLIC_ADMIN_HOST

  /* Host gate (runs before everything, including the emulator bypass, so
   * admin.localhost works in local dev). The control surface is reachable
   * ONLY from the admin host; on every other host it 404s. Authorization
   * is enforced server-side by requirePlatformAdmin() - the edge can't run
   * the Admin SDK, so this layer only routes. */
  if (adminHost && host === adminHost) {
    if (ADMIN_PASSTHROUGH_PREFIXES.some((p) => pathname.startsWith(p))) {
      return NextResponse.next()
    }
    const url = req.nextUrl.clone()
    url.pathname = `/control${pathname === "/" ? "" : pathname}`
    return NextResponse.rewrite(url)
  }
  if (
    pathname === "/control" ||
    pathname.startsWith("/control/") ||
    pathname.startsWith("/api/control/")
  ) {
    return new NextResponse("Not found", { status: 404 })
  }

  if (process.env.NEXT_PUBLIC_USE_EMULATORS === "1") return NextResponse.next()

  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next()
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next()

  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value)
  if (hasSession) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = "/login"
  url.searchParams.set("next", pathname + req.nextUrl.search)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    /* Match everything except static assets and the public icons. */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
