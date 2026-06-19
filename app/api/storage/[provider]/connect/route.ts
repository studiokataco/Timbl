import { type NextRequest, NextResponse } from "next/server"

import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { settingsRedirect } from "@/lib/publishing/oauth"
import { getStorageConnector } from "@/lib/storage/connectors"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function back(error: string) {
  return NextResponse.redirect(
    settingsRedirect("/settings/integrations", { storage_error: error }),
  )
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ provider: string }> },
) {
  const { provider } = await ctx.params
  const connector = getStorageConnector(provider)
  if (!connector) return back("unknown_provider")

  const orgId = await getCurrentOrgId()
  try {
    const { url } = await connector.connect(orgId)
    return NextResponse.redirect(url)
  } catch {
    return back("not_configured")
  }
}
