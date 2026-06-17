import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { LandingPage } from "@/components/marketing/landing-page"
import { DEV_ORG_COOKIE, IS_DEV_SHIM } from "@/lib/auth/dev-session"
import { readSessionAuth } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

const TITLE = "Timbl - AI Social Media Planner"
const DESCRIPTION =
  "Plan campaigns and posts across Instagram, Facebook, LinkedIn and X from one calendar or kanban. Timbl's agents draft and schedule - you approve every post before it ships."

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    title: TITLE,
    description: DESCRIPTION,
  },
}

export default async function Home() {
  if (!IS_DEV_SHIM) {
    const auth = await readSessionAuth()
    if (auth?.workspace) redirect("/calendar")
    if (auth) redirect("/workspaces")
    return <LandingPage />
  }

  const store = await cookies()
  if (store.has(DEV_ORG_COOKIE)) redirect("/calendar")
  return <LandingPage />
}
