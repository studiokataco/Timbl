"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { ChannelsManager } from "@/components/settings/channels-manager"
import type { WithId } from "@/lib/firebase/serialize"
import type { SocialAccountPublic } from "@/lib/schemas"

const ERRORS: Record<string, string> = {
  plan: "You've reached your plan's connected-channel limit.",
  state: "Connection expired or was tampered with. Try again.",
  callback: "Couldn't finish connecting. Try again.",
  connect: "Couldn't start the connection. Try again.",
  oauth: "The provider didn't return an authorization code.",
  unknown_channel: "Unknown channel.",
}

export function ChannelsClient({ accounts }: { accounts: WithId<SocialAccountPublic>[] }) {
  const params = useSearchParams()

  useEffect(() => {
    const error = params.get("error")
    if (error) toast.error(ERRORS[error] ?? "Something went wrong.")
    else if (params.get("connected")) toast.success("Channel connected")
  }, [params])

  return <ChannelsManager accounts={accounts} />
}
