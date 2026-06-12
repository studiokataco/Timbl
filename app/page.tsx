import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { LandingPage } from "@/components/marketing/landing-page"
import { DEV_ORG_COOKIE, IS_DEV_SHIM } from "@/lib/auth/dev-session"
import { readSessionAuth } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

const TITLE = "Timbl - the calendar-first social media planner for agencies and brands"
const DESCRIPTION =
  "Plan, draft and schedule posts across Instagram, Facebook, LinkedIn and X from one calendar. AI agents handle ideas and drafts - you approve what ships."

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
