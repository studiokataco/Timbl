"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { GoogleDriveIcon } from "@/components/marketing/brand-icons"
import {
  getStorageAccessToken,
  listStorageAccounts,
} from "@/lib/actions/storage-accounts"
import { getStoragePickerConfig } from "@/lib/actions/storage-picker"
import { STORAGE_PROVIDERS } from "@/lib/storage/providers"
import { faviconUrl } from "@/lib/url"
import type { DesignLink, StorageProvider } from "@/lib/schemas"

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { Dropbox?: any; gapi?: any; google?: any }
}

const PICK_LABELS: Record<StorageProvider, string> = {
  gdrive: "Add Drive Link",
  dropbox: "Add Dropbox Link",
}

type DropboxFile = { link: string; name: string; thumbnailLink?: string }
type DriveDoc = { url: string; name: string; thumbnails?: Array<{ url: string }> }
type PickerData = { action: unknown; docs?: DriveDoc[] }

function injectScript(
  src: string,
  init?: (el: HTMLScriptElement) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    )
    if (existing) {
      if (existing.dataset.ready === "true") return resolve()
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () =>
        reject(new Error(`Failed to load ${src}`)),
      )
      return
    }
    const el = document.createElement("script")
    el.src = src
    el.async = true
    init?.(el)
    el.addEventListener("load", () => {
      el.dataset.ready = "true"
      resolve()
    })
    el.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)))
    document.head.appendChild(el)
  })
}

export function PickFromStorage({
  onPick,
}: {
  onPick: (links: DesignLink[]) => void
}) {
  const { data } = useQuery({
    queryKey: ["storage-accounts"],
    queryFn: () => listStorageAccounts(),
  })

  const accountByProvider = new Map<StorageProvider, string>()
  for (const account of data ?? []) {
    if (account.status === "active" && !accountByProvider.has(account.provider)) {
      accountByProvider.set(account.provider, account.id)
    }
  }

  const connected = STORAGE_PROVIDERS.filter((p) => accountByProvider.has(p.key))
  if (connected.length === 0) {
    if (!data) return null
    return (
      <p className="text-xs text-muted-foreground">
        <Link
          href="/settings/integrations"
          className="font-medium text-foreground underline underline-offset-2"
        >
          Connect Drive or Dropbox
        </Link>{" "}
      </p>
    )
  }

  async function pickDropbox() {
    const res = await getStoragePickerConfig("dropbox")
    if (!res.ok) return toast.error(`Dropbox is not ready: ${res.error}`)
    await injectScript(
      "https://www.dropbox.com/static/api/2/dropins.js",
      (el) => {
        el.id = "dropboxjs"
        el.setAttribute("data-app-key", res.clientId)
      },
    )
    window.Dropbox.choose({
      multiselect: true,
      linkType: "preview",
      success: (files: DropboxFile[]) =>
        onPick(
          files.map((file): DesignLink => ({
            url: file.link,
            provider: "dropbox",
            label: file.name,
            thumbnailUrl: file.thumbnailLink,
            source: "picker",
          })),
        ),
      cancel: () => {},
    })
  }

  async function pickGoogle(accountId: string) {
    const cfg = await getStoragePickerConfig("gdrive")
    if (!cfg.ok) return toast.error(`Google Drive: ${cfg.error}`)
    if (!cfg.apiKey) {
      return toast.error(
        "Add a Google Drive picker API key in Settings to enable picking",
      )
    }
    const tokenRes = await getStorageAccessToken(accountId)
    if (!tokenRes.ok) return toast.error(`Google Drive: ${tokenRes.error}`)
    await injectScript("https://apis.google.com/js/api.js")
    await new Promise<void>((resolve) =>
      window.gapi.load("picker", () => resolve()),
    )
    const picker = new window.google.picker.PickerBuilder()
      .setOAuthToken(tokenRes.token)
      .setDeveloperKey(cfg.apiKey)
      .addView(window.google.picker.ViewId.DOCS)
      .setCallback((pickerData: PickerData) => {
        if (pickerData.action !== window.google.picker.Action.PICKED) return
        onPick(
          (pickerData.docs ?? []).map((doc): DesignLink => ({
            url: doc.url,
            provider: "gdrive",
            label: doc.name,
            thumbnailUrl: doc.thumbnails?.[0]?.url,
            source: "picker",
          })),
        )
      })
      .build()
    picker.setVisible(true)
  }

  async function handlePick(provider: StorageProvider, accountId: string) {
    try {
      if (provider === "dropbox") await pickDropbox()
      else if (provider === "gdrive") await pickGoogle(accountId)
    } catch {
      const label = STORAGE_PROVIDERS.find((p) => p.key === provider)?.label
      toast.error(`Could not open the ${label ?? "storage"} picker`)
    }
  }

  return (
    <>
      {connected.map((provider) => {
        const accountId = accountByProvider.get(provider.key)!
        return (
          <Button
            key={provider.key}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handlePick(provider.key, accountId)}
          >
            {provider.key === "gdrive" ? (
              <GoogleDriveIcon aria-hidden className="size-3.5" />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={faviconUrl(`https://${provider.domain}`)}
                alt=""
                width={14}
                height={14}
                className="size-3.5"
                loading="lazy"
              />
            )}
            {PICK_LABELS[provider.key]}
          </Button>
        )
      })}
    </>
  )
}
