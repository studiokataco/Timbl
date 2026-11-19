import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { SignInForm } from "@/components/auth/sign-in-form"
import { DEV_ORG_COOKIE, IS_DEV_SHIM } from "@/lib/auth/dev-session"
import { readSessionAuth } from "@/lib/auth/session"
import { DEFAULT_APP_ROUTE } from "@/lib/constants/timbl"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Log in",
  description: "Log in to your Timbl workspace.",
}

export default async function LoginPage() {
  if (IS_DEV_SHIM) {
    const store = await cookies()
    if (store.has(DEV_ORG_COOKIE)) redirect(DEFAULT_APP_ROUTE)
  } else {
    const auth = await readSessionAuth()
    if (auth?.workspace) redirect(DEFAULT_APP_ROUTE)
    if (auth) redirect("/workspaces")
  }

  return <SignInForm />
}
