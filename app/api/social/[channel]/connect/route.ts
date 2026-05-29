import { type NextRequest, NextResponse } from "next/server"

import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { getPublisher } from "@/lib/publishing/registry"
import { assertCanConnect } from "@/lib/actions/social-accounts"
import { gateErrorToResult } from "@/lib/plans/gate"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ channel: string }> },
) {
  const { channel } = await ctx.params
  const publisher = getPublisher(channel)
  if (!publisher) {
    return NextResponse.redirect(new URL("/settings/channels?error=unknown_channel", req.url))
  }

  const orgId = await getCurrentOrgId()
  try {
    await assertCanConnect(orgId)
  } catch (err) {
    if (gateErrorToResult(err)) {
      return NextResponse.redirect(new URL("/settings/channels?error=plan", req.url))
    }
    return NextResponse.redirect(new URL("/settings/channels?error=connect", req.url))
  }

  try {
    const { url } = await publisher.connect(orgId)
    return NextResponse.redirect(url)
  } catch {
    return NextResponse.redirect(new URL("/settings/channels?error=connect", req.url))
  }
}
