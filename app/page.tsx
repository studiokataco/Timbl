import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { DEV_ORG_COOKIE, IS_DEV_SHIM } from "@/lib/auth/dev-session"

/*
 * App entry. In emulator dev mode, a developer who hasn't yet picked a
 * workspace (no safe_dev_org cookie) lands on the /welcome chooser first.
 * Once a choice is made — or in production, where the org comes from the
 * verified session — `/` goes straight to the calendar.
 */
export default async function Home() {
  if (IS_DEV_SHIM) {
    const hasChoice = (await cookies()).has(DEV_ORG_COOKIE)
    if (!hasChoice) redirect("/welcome")
  }
  redirect("/calendar")
}
