"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { ChevronRight, KeyRound, Loader2, Settings2 } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import { ChannelGlyph } from "@/components/shared/channel-glyph"
import { ListPanel } from "@/components/shared/list-panel"
import {
  ConnectionRow,
  CopyField,
  LogoTile,
} from "@/components/settings/integrations-bits"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { setPlatformOauthApp } from "@/lib/actions/oauth-apps"
import { disconnectAccount } from "@/lib/actions/social-accounts"
import { parseInto } from "@/lib/forms/zod-form"
import { CHANNEL_LABELS } from "@/lib/labels/enums"
import { cn } from "@/lib/utils"
import type { WithId } from "@/lib/firebase/serialize"
import type { ChannelKey } from "@/lib/schemas/_shared"
import type { SocialAccountPublic } from "@/lib/schemas"

type ChannelDef = {
  key: ChannelKey
  appLabel: string
  consoleName: string
  consoleUrl: string
  consoleHint: string
  connectHint?: string
  setupSteps: string[]
}

const CHANNELS: ChannelDef[] = [
  {
    key: "linkedin",
    appLabel: "LinkedIn app",
    consoleName: "LinkedIn developer console",
    consoleUrl: "https://www.linkedin.com/developers/apps",
    consoleHint: "Create an app and turn on Sign In with LinkedIn and Share on LinkedIn.",
    setupSteps: [
      "Open the LinkedIn developer console and create a new app linked to a Company Page.",
      "On the Products tab, request Sign In with LinkedIn using OpenID Connect and Share on LinkedIn.",
      "On the Auth tab, paste the redirect URI into Authorized redirect URLs for your app.",
      "Copy the Client ID and Client Secret from the Auth tab.",
    ],
  },
  {
    key: "x",
    appLabel: "X app",
    consoleName: "X developer portal",
    consoleUrl: "https://developer.x.com/en/portal/dashboard",
    consoleHint: "Create a project and turn on OAuth 2.0 with read, write and offline access.",
    setupSteps: [
      "Open the developer portal and create a project and app (the free tier is fine).",
      "Under User authentication settings, set App permissions to Read and write.",
      "Set Type of App to Web App and Confidential client.",
      "Paste the redirect URI into Callback URI / Redirect URL.",
      "Add any website URL into Website URL. X requires it even if unused.",
      "Save, then copy the OAuth 2.0 Client ID and Client Secret from the Keys and tokens tab.",
    ],
  },
  {
    key: "facebook",
    appLabel: "Meta app (Facebook and Instagram)",
    consoleName: "Meta developer console",
    consoleUrl: "https://developers.facebook.com/apps",
    consoleHint: "Create a Business app. The same credentials power Facebook and Instagram.",
    setupSteps: [
      "Open the Meta developer console and create a Business type app.",
      "Add the Facebook Login for Business product.",
      "Under Settings > Basic, paste the redirect URI into Valid OAuth Redirect URIs and App Domains.",
      "Request the pages_show_list, pages_manage_posts and pages_read_engagement permissions.",
      "Copy the App ID (Client ID) and App Secret (Client Secret) from Settings > Basic.",
    ],
  },
  {
    key: "instagram",
    appLabel: "Meta app (Facebook and Instagram)",
    consoleName: "Meta developer console",
    consoleUrl: "https://developers.facebook.com/apps",
    consoleHint: "Create a Business app. The same credentials power Facebook and Instagram.",
    connectHint: "Connects through your Facebook Page",
    setupSteps: [
      "Reuse the Meta app you set up for Facebook (same App ID and Secret).",
      "Make sure the Instagram business account is linked to a Facebook Page you manage.",
      "Add the instagram_basic, instagram_content_publish, pages_show_list and pages_read_engagement permissions.",
      "Paste the same redirect URI into Valid OAuth Redirect URIs.",
    ],
  },
]

type Account = WithId<SocialAccountPublic>

type Props = {
  accounts: Account[]
  configuredChannels: ChannelKey[]
  redirectUriByChannel: Record<ChannelKey, string>
  isAdmin: boolean
  brandId: string
  brandName: string
}

export function ChannelsManager({
  accounts,
  configuredChannels,
  redirectUriByChannel,
  isAdmin,
  brandId,
  brandName,
}: Props) {
  const router = useRouter()
  const [setupKey, setSetupKey] = useState<ChannelKey | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const configured = new Set(configuredChannels)
  const setupChannel = CHANNELS.find((c) => c.key === setupKey) ?? null

  function openSetup(key: ChannelKey) {
    setSetupKey(key)
    setSetupOpen(true)
  }

  return (
    <>
      <ListPanel>
        <ul className="divide-y divide-border">
          {CHANNELS.map((ch) => {
            const label = CHANNEL_LABELS[ch.key]
            const isConfigured = configured.has(ch.key)
            return (
              <ConnectionRow
                key={ch.key}
                name={label}
                leading={
                  <LogoTile className={cn(ch.key === "x" && "dark:[&>*]:invert")}>
                    <ChannelGlyph channel={ch.key} />
                  </LogoTile>
                }
                accounts={accounts.filter((a) => a.channel === ch.key)}
                connectHref={
                  isConfigured
                    ? `/api/social/${ch.key}/connect?brand=${encodeURIComponent(brandId)}`
                    : null
                }
                idleHint={ch.connectHint}
                blockedHint={isAdmin ? "Add app credentials to turn it on" : "An admin needs to set it up"}
                blockedAction={
                  isAdmin ? (
                    <Button variant="outline" className="h-9 px-3 text-[13px]" onClick={() => openSetup(ch.key)}>
                      <Settings2 aria-hidden />
                      Set up
                    </Button>
                  ) : undefined
                }
                menuExtras={
                  isAdmin && isConfigured ? (
                    <DropdownMenuItem className="gap-2 py-1.5 text-[13px]" onClick={() => openSetup(ch.key)}>
                      <KeyRound aria-hidden />
                      App credentials
                    </DropdownMenuItem>
                  ) : undefined
                }
                disconnect={disconnectAccount}
                disconnectNote={`${brandName} stops publishing to this ${label} account until you connect it again.`}
              />
            )
          })}
        </ul>
      </ListPanel>

      {setupChannel ? (
        <SetupDialog
          key={setupChannel.key}
          channel={setupChannel}
          redirectUri={redirectUriByChannel[setupChannel.key]}
          isConfigured={configured.has(setupChannel.key)}
          open={setupOpen}
          onClose={() => setSetupOpen(false)}
          onSaved={() => {
            setSetupOpen(false)
            router.refresh()
          }}
        />
      ) : null}
    </>
  )
}

const credentialsSchema = z.object({
  clientId: z.string().trim().min(1, "Enter the client ID"),
  clientSecret: z.string().trim().min(1, "Enter the client secret"),
})
type Credentials = z.infer<typeof credentialsSchema>

function SetupDialog({
  channel,
  redirectUri,
  isConfigured,
  open,
  onClose,
  onSaved,
}: {
  channel: ChannelDef
  redirectUri: string
  isConfigured: boolean
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, startSaving] = useTransition()
  const form = useForm<Credentials>({ defaultValues: { clientId: "", clientSecret: "" } })
  const { errors } = form.formState
  const label = CHANNEL_LABELS[channel.key]
  const idField = `${channel.key}-client-id`
  const secretField = `${channel.key}-client-secret`

  function close() {
    if (saving) return
    form.reset()
    onClose()
  }

  const onSubmit = form.handleSubmit((raw) => {
    const values = parseInto(credentialsSchema, raw, form.setError)
    if (!values) return
    startSaving(async () => {
      const res = await setPlatformOauthApp(channel.key, values.clientId, values.clientSecret)
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't save credentials")
        return
      }
      toast.success(`${label} is ready to connect`)
      form.reset()
      onSaved()
    })
  })

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isConfigured ? "Update" : "Set up"} {channel.appLabel}
          </DialogTitle>
          <DialogDescription className="text-[13px]">
            An admin does this once. After that, anyone in the workspace can connect {label}.
          </DialogDescription>
        </DialogHeader>

        <form id={`${channel.key}-oauth-setup`} onSubmit={onSubmit} noValidate className="grid gap-5">
          <div className="grid gap-2">
            <p className="text-[13px] font-medium text-foreground">Redirect URI</p>
            <CopyField value={redirectUri} label="Copy redirect URI" />
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Paste it exactly into the{" "}
              <a
                href={channel.consoleUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground underline underline-offset-2"
              >
                {channel.consoleName}
              </a>{" "}
              as the OAuth redirect URL. {channel.consoleHint}
            </p>
          </div>

          <details className="group rounded-lg bg-secondary/50">
            <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-[13px] font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <ChevronRight
                aria-hidden
                className="size-3.5 text-muted-foreground transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none"
              />
              Where to find these
            </summary>
            <ol className="ml-8 list-decimal space-y-1.5 pb-3 pr-3 text-[12px] leading-relaxed text-muted-foreground">
              {channel.setupSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </details>

          <div className="grid gap-1.5">
            <label htmlFor={idField} className="text-[13px] font-medium text-foreground">
              Client ID
            </label>
            <Input
              id={idField}
              autoComplete="off"
              aria-invalid={!!errors.clientId}
              className="h-9"
              {...form.register("clientId")}
            />
            {errors.clientId ? (
              <p className="text-[12px] text-rose-600 dark:text-rose-400">{errors.clientId.message}</p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <label htmlFor={secretField} className="text-[13px] font-medium text-foreground">
              Client secret
            </label>
            <Input
              id={secretField}
              type="password"
              autoComplete="off"
              aria-invalid={!!errors.clientSecret}
              className="h-9"
              {...form.register("clientSecret")}
            />
            {errors.clientSecret ? (
              <p className="text-[12px] text-rose-600 dark:text-rose-400">{errors.clientSecret.message}</p>
            ) : (
              <p className="text-[12px] text-muted-foreground">
                {isConfigured
                  ? "Enter both values to replace the saved pair. Stored encrypted and never shown again."
                  : "Stored encrypted and never shown again."}
              </p>
            )}
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="ghost" className="h-9" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={`${channel.key}-oauth-setup`} className="h-9" disabled={saving}>
            {saving && <Loader2 className="animate-spin" aria-hidden />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
