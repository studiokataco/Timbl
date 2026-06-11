import "server-only"

import { notFound, redirect } from "next/navigation"

import { readSessionAuth } from "@/lib/auth/session"
import { ROOT_PLATFORM_ADMIN_EMAIL } from "@/lib/platform/schema"

export { ROOT_PLATFORM_ADMIN_EMAIL }

/*
 * The single gate for the control centre (admin subdomain). The Admin SDK
 * bypasses Security Rules, so this app-layer check is the real boundary -
 * it runs in the (control) layout AND independently inside every platform
 * server action (a layout guard does not protect POST-invocable actions).
 *
 * On failure we call notFound() rather than redirect: an unauthorised
 * visitor should not be able to tell the control surface exists.
 *
 * Dev: under the emulator shim there are no real custom claims, so the
 * surface is unlocked by PLATFORM_ADMIN_DEV=1. The actor is the root admin
 * so audit rows are still attributable in local testing.
 */

const useDevShim = process.env.NEXT_PUBLIC_USE_EMULATORS === "1"

export type PlatformRole = "owner" | "analyst"

export interface PlatformActor {
  uid: string
  email: string
  role: PlatformRole
}

/** Returns the platform actor, or null if the caller is not a platform admin. */
export async function readPlatformActor(): Promise<PlatformActor | null> {
  if (useDevShim) {
    const devFlag = process.env.PLATFORM_ADMIN_DEV
    if (devFlag) {
      /* PLATFORM_ADMIN_DEV=analyst previews the read-only experience locally;
       * any other truthy value (e.g. "1") is owner. */
      const role: PlatformRole = devFlag === "analyst" ? "analyst" : "owner"
      return { uid: "dev-platform-admin", email: ROOT_PLATFORM_ADMIN_EMAIL, role }
    }
    return null
  }
  const auth = await readSessionAuth()
  if (!auth || auth.platform !== "admin") return null
  return { uid: auth.uid, email: auth.email, role: auth.platformRole ?? "owner" }
}

/**
 * Gate for the control surface. Returns the platform actor, or:
 *   - signed out (prod): redirect to the control-centre sign-in on the
 *     admin host (/login rewrites into /control/login there).
 *   - signed in but not a platform admin: 404 (don't reveal the surface).
 *   - dev shim without PLATFORM_ADMIN_DEV: 404.
 */
export async function requirePlatformAdmin(): Promise<PlatformActor> {
  const actor = await readPlatformActor()
  if (actor) return actor

  if (!useDevShim) {
    const auth = await readSessionAuth()
    /* Relative: stays on the admin host, where /login rewrites to the
     * control-centre sign-in. */
    if (!auth) redirect("/login")
  }
  notFound()
}
