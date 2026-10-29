"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { ChannelsManager } from "@/components/settings/channels-manager"
import type { WithId } from "@/lib/firebase/serialize"
import type { ChannelKey } from "@/lib/schemas/_shared"
import type { SocialAccountPublic } from "@/lib/schemas"

const ERRORS: Record<string, string> = {
  plan: "This brand has reached its plan's limit for connected accounts.",
  state: "The connection expired before it finished. Try again.",
  callback: "Couldn't finish connecting. Try again.",
  connect: "Couldn't start the connection. Try again.",
  not_configured: "Add this platform's app credentials first.",
  oauth: "The platform didn't send back an approval. Try again.",
  unknown_channel: "That platform isn't supported.",
}

export function ChannelsClient({
  accounts,
  configuredChannels,
  redirectUriByChannel,
  isAdmin,
  brandId,
  brandName,
}: {
  accounts: WithId<SocialAccountPublic>[]
  configuredChannels: ChannelKey[]
  redirectUriByChannel: Record<ChannelKey, string>
  isAdmin: boolean
  brandId: string
  brandName: string
}) {
  const params = useSearchParams()

  useEffect(() => {
    const error = params.get("error")
    if (error) {
      const detail = params.get("detail")
      toast.error(ERRORS[error] ?? "Something went wrong.", {
        description: detail ?? undefined,
      })
    } else if (params.get("connected")) toast.success("Account connected")
  }, [params])

  return (
    <ChannelsManager
      accounts={accounts}
      configuredChannels={configuredChannels}
      redirectUriByChannel={redirectUriByChannel}
      isAdmin={isAdmin}
      brandId={brandId}
      brandName={brandName}
    />
  )
}
