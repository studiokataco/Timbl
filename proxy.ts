import { NextResponse, type NextRequest } from "next/server"

/*
 * Edge proxy (Next 16's evolution of middleware.ts) — gates the app on
 * session-cookie presence. Real verification happens in
 * `lib/auth/session.ts` on Node-runtime server actions and route
 * handlers; this layer is a UX hint that redirects unauthenticated users
 * to /login instead of letting them see a server error.
 *
 * Local emulator mode (NEXT_PUBLIC_USE_EMULATORS=1) bypasses the gate
 * entirely — the dev shim in `lib/auth/dev-session.ts` provides identity.
 */

const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/logout"]
const PUBLIC_PREFIXES = ["/_next/", "/api/agents/cron/"]
const SESSION_COOKIE = "__session"

export default function proxy(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_USE_EMULATORS === "1") return NextResponse.next()

  const { pathname } = req.nextUrl
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
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
