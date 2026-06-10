import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { DEV_ORG_COOKIE, IS_DEV_SHIM } from "@/lib/auth/dev-session"
import { readSessionAuth } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

export default async function Home() {
  if (!IS_DEV_SHIM) {
    const auth = await readSessionAuth()
    if (auth?.workspace) redirect("/calendar")
    if (auth) redirect("/workspaces")
    redirect("/login")
  }

  const store = await cookies()
  if (store.has(DEV_ORG_COOKIE)) redirect("/calendar")
  redirect("/login")
}
