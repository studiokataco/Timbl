import { redirect } from "next/navigation"

import { ControlSignIn } from "@/components/control/control-sign-in"
import { readPlatformActor } from "@/lib/auth/platform-guard"

export const dynamic = "force-dynamic"

export const metadata = { robots: { index: false, follow: false } }

export default async function ControlLoginPage() {
  const actor = await readPlatformActor()
  if (actor) redirect("/dashboard")
  return <ControlSignIn />
}
