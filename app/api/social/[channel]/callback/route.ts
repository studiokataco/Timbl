import { type NextRequest, NextResponse } from "next/server"

import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { getAdminDb } from "@/lib/firebase/admin"
import { orgSocialAccountsPath } from "@/lib/firebase/paths"
import { getPublisher } from "@/lib/publishing/registry"
import { verifyState } from "@/lib/publishing/state"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function back(req: NextRequest, error?: string) {
  const url = new URL("/settings/channels", req.url)
  if (error) url.searchParams.set("error", error)
  else url.searchParams.set("connected", "1")
  return NextResponse.redirect(url)
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ channel: string }> },
) {
  const { channel } = await ctx.params
  const publisher = getPublisher(channel)
  if (!publisher) return back(req, "unknown_channel")

  const code = req.nextUrl.searchParams.get("code")
  const state = req.nextUrl.searchParams.get("state")
  if (!code || !state) return back(req, "oauth")

  const orgId = await getCurrentOrgId()
  if (!verifyState(orgId, state)) return back(req, "state")

  try {
    const account = await publisher.callback(orgId, code, state)
    await getAdminDb()
      .doc(`${orgSocialAccountsPath(orgId)}/${account.id}`)
      .set(account, { merge: true })
    return back(req)
  } catch {
    return back(req, "callback")
  }
}
