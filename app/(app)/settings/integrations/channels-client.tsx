"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { ChannelsManager } from "@/components/settings/channels-manager"
import type { WithId } from "@/lib/firebase/serialize"
import type { ChannelKey } from "@/lib/schemas/_shared"
import type { SocialAccountPublic } from "@/lib/schemas"

const ERRORS: Record<string, string> = {
  plan: "You've reached your plan's connected-channel limit.",
  state: "Connection expired or was tampered with. Try again.",
  callback: "Couldn't finish connecting. Try again.",
  connect: "Couldn't start the connection. Try again.",
  not_configured: "Set up this channel's OAuth credentials first.",
  oauth: "The provider didn't return an authorization code.",
  unknown_channel: "Unknown channel.",
}

export function ChannelsClient({
  accounts,
  configuredChannels,
  redirectUriByChannel,
  isAdmin,
}: {
  accounts: WithId<SocialAccountPublic>[]
  configuredChannels: ChannelKey[]
  redirectUriByChannel: Record<ChannelKey, string>
  isAdmin: boolean
}) {
  const params = useSearchParams()

  useEffect(() => {
    const error = params.get("error")
    if (error) {
      const detail = params.get("detail")
      toast.error(ERRORS[error] ?? "Something went wrong.", {
        description: detail ?? undefined,
      })
    } else if (params.get("connected")) toast.success("Channel connected")
  }, [params])

  return (
    <ChannelsManager
      accounts={accounts}
      configuredChannels={configuredChannels}
      redirectUriByChannel={redirectUriByChannel}
      isAdmin={isAdmin}
    />
  )
}
