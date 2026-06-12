import { redirect } from "next/navigation"

import { WorkspacePicker } from "@/components/auth/workspace-picker"
import { IS_DEV_SHIM } from "@/lib/auth/dev-session"
import { listMembershipsForEmail } from "@/lib/auth/membership"
import { readSessionAuth } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Choose a workspace",
  robots: { index: false, follow: false },
}

export default async function WorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>
}) {
  const sp = await searchParams
  const highlightNew = sp.new === "1"

  if (IS_DEV_SHIM) {
    return (
      <WorkspacePicker workspaces={[]} devShim highlightNew={highlightNew} />
    )
  }

  const auth = await readSessionAuth()
  if (!auth) redirect("/")
  if (auth.workspace) redirect("/calendar")

  const workspaces = await listMembershipsForEmail(auth.email)

  return (
    <WorkspacePicker
      workspaces={workspaces}
      devShim={false}
      highlightNew={highlightNew}
    />
  )
}
