import { type NextRequest, NextResponse } from "next/server"

import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { getPublisher } from "@/lib/publishing/registry"
import { assertCanConnect } from "@/lib/actions/social-accounts"
import { gateErrorToResult } from "@/lib/plans/gate"
import { settingsRedirect } from "@/lib/publishing/oauth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function back(error: string) {
  return NextResponse.redirect(settingsRedirect("/settings/integrations", { error }))
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ channel: string }> },
) {
  const { channel } = await ctx.params
  const publisher = getPublisher(channel)
  if (!publisher) return back("unknown_channel")

  const orgId = await getCurrentOrgId()
  try {
    await assertCanConnect(orgId)
  } catch (err) {
    if (gateErrorToResult(err)) return back("plan")
    return back("connect")
  }

  try {
    const { url } = await publisher.connect(orgId)
    return NextResponse.redirect(url)
  } catch {
    return back("not_configured")
  }
}
