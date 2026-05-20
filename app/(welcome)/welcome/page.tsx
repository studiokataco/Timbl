export const dynamic = "force-dynamic"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { WorkspaceChooser } from "@/components/welcome/workspace-chooser"
import {
  DEV_ORG_COOKIE,
  IS_DEV_SHIM,
  normalizeDevOrgMode,
  type DevOrgMode,
} from "@/lib/auth/dev-session"

export const metadata = { title: "Choose a workspace" }

/*
 * Dev-only opening chooser. In production the org comes from the verified
 * Firebase session, so there is nothing to choose — bounce to the app.
 *
 * `currentMode` is null until the developer has picked once; the chooser
 * uses it only to badge the workspace they're currently in on a revisit.
 */
export default async function WelcomePage() {
  if (!IS_DEV_SHIM) redirect("/calendar")
  const raw = (await cookies()).get(DEV_ORG_COOKIE)?.value
  const currentMode: DevOrgMode | null = raw ? normalizeDevOrgMode(raw) : null
  return <WorkspaceChooser currentMode={currentMode} />
}
