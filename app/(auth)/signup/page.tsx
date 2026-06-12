import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { SignUpForm } from "@/components/auth/sign-up-form"
import { DEV_ORG_COOKIE, IS_DEV_SHIM } from "@/lib/auth/dev-session"
import { readSessionAuth } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Sign up",
  description: "Create a Timbl workspace and start planning your social content.",
}

export default async function SignUpPage() {
  if (IS_DEV_SHIM) {
    const store = await cookies()
    if (store.has(DEV_ORG_COOKIE)) redirect("/calendar")
  } else {
    const auth = await readSessionAuth()
    if (auth?.workspace) redirect("/calendar")
    if (auth) redirect("/workspaces")
  }

  return <SignUpForm />
}
