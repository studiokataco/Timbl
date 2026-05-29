import { type NextRequest, NextResponse } from "next/server"

import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { getAdminDb } from "@/lib/firebase/admin"
import { orgSocialAccountsPath } from "@/lib/firebase/paths"
import { settingsRedirect } from "@/lib/publishing/oauth"
import { getPublisher } from "@/lib/publishing/registry"
import { verifyState } from "@/lib/publishing/state"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function back(error?: string) {
  const params: Record<string, string> = error ? { error } : { connected: "1" }
  return NextResponse.redirect(settingsRedirect("/settings/channels", params))
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ channel: string }> },
) {
  const { channel } = await ctx.params
  const publisher = getPublisher(channel)
  if (!publisher) return back("unknown_channel")

  const code = req.nextUrl.searchParams.get("code")
  const state = req.nextUrl.searchParams.get("state")
  if (!code || !state) return back("oauth")

  const orgId = await getCurrentOrgId()
  if (!verifyState(orgId, state)) return back("state")

  try {
    const account = await publisher.callback(orgId, code, state)
    await getAdminDb()
      .doc(`${orgSocialAccountsPath(orgId)}/${account.id}`)
      .set(account, { merge: true })
    return back()
  } catch {
    return back("callback")
  }
}
