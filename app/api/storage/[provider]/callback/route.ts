import { type NextRequest, NextResponse } from "next/server"

import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { getAdminDb } from "@/lib/firebase/admin"
import { orgStorageAccountsPath } from "@/lib/firebase/paths"
import { settingsRedirect } from "@/lib/publishing/oauth"
import { verifyState } from "@/lib/publishing/state"
import { getStorageConnector } from "@/lib/storage/connectors"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function back(error?: string, detail?: string) {
  const params: Record<string, string> = error
    ? { storage_error: error, ...(detail ? { storage_detail: detail.slice(0, 200) } : {}) }
    : { storage: "connected" }
  return NextResponse.redirect(settingsRedirect("/settings/integrations", params))
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> },
) {
  const { provider } = await ctx.params
  const connector = getStorageConnector(provider)
  if (!connector) return back("unknown_provider")

  const code = req.nextUrl.searchParams.get("code")
  const state = req.nextUrl.searchParams.get("state")
  if (!code || !state) return back("oauth")

  const orgId = await getCurrentOrgId()
  if (!verifyState(orgId, state)) return back("state")

  try {
    const account = await connector.callback(orgId, code, state)
    await getAdminDb()
      .doc(`${orgStorageAccountsPath(orgId)}/${account.id}`)
      .set(account, { merge: true })
    return back()
  } catch (err) {
    return back("callback", err instanceof Error ? err.message : String(err))
  }
}
