"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { StorageManager } from "@/components/settings/storage-manager"
import type { WithId } from "@/lib/firebase/serialize"
import type { StorageProvider } from "@/lib/schemas/_shared"
import type { StorageAccountPublic } from "@/lib/schemas"

const ERRORS: Record<string, string> = {
  unknown_provider: "Unknown storage provider.",
  not_configured: "This provider isn't available yet.",
  state: "Connection expired or was tampered with. Try again.",
  callback: "Couldn't finish connecting. Try again.",
  oauth: "The provider didn't return an authorization code.",
}

export function StorageClient({
  accounts,
  availableProviders,
}: {
  accounts: WithId<StorageAccountPublic>[]
  availableProviders: StorageProvider[]
}) {
  const params = useSearchParams()

  useEffect(() => {
    const error = params.get("storage_error")
    if (error) {
      const detail = params.get("storage_detail")
      toast.error(ERRORS[error] ?? "Something went wrong", {
        description: detail ?? undefined,
      })
    } else if (params.get("storage") === "connected") {
      toast.success("Storage connected")
    }
  }, [params])

  return (
    <StorageManager accounts={accounts} availableProviders={availableProviders} />
  )
}
