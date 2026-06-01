"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Check, Copy, Link2, Settings2, Unplug } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { setPlatformOauthApp } from "@/lib/actions/oauth-apps"
import { disconnectAccount } from "@/lib/actions/social-accounts"
import { cn } from "@/lib/utils"
import type { WithId } from "@/lib/firebase/serialize"
import type { ChannelKey } from "@/lib/schemas/_shared"
import type { SocialAccountPublic } from "@/lib/schemas"

type ChannelDef = {
  key: ChannelKey
  label: string
  /* Friendly name shown inside the setup dialog - Meta shares one app
   * pair across Facebook + Instagram, so the dialog labels it accordingly. */
  appLabel: string
  /* https://...console URL surfaced as a help link in the setup dialog. */
  consoleUrl: string
  /* One-line setup hint describing what to enable in the console. */
  consoleHint: string
  /* Optional note shown on the card explaining how the connect flow behaves
   * (e.g. Instagram authenticates through Facebook). */
  connectHint?: string
  /* Numbered, channel-specific console steps shown in the setup dialog. */
  setupSteps?: string[]
}

const CHANNELS: ChannelDef[] = [
  {
    key: "linkedin",
    label: "LinkedIn",
    appLabel: "LinkedIn app",
    consoleUrl: "https://www.linkedin.com/developers/apps",
    consoleHint: "Create an app, enable Sign In with LinkedIn + Share on LinkedIn.",
    setupSteps: [
      "Open the LinkedIn developers console and create a new app linked to a Company Page.",
      "On the Products tab, request Sign In with LinkedIn using OpenID Connect and Share on LinkedIn.",
      "On the Auth tab, paste the redirect URI above into Authorized redirect URLs for your app.",
      "Copy the Client ID and Client Secret from the Auth tab.",
    ],
  },
  {
    key: "x",
    label: "X",
    appLabel: "X app",
    consoleUrl: "https://developer.x.com/en/portal/dashboard",
    consoleHint: "Create a project, enable OAuth 2.0 with read+write+offline scopes.",
    setupSteps: [
      "Open the developer portal and create a project + app (free tier is fine).",
      "Under User authentication settings, set App permissions to Read and write.",
      "Set Type of App to Web App and Confidential client.",
      "Paste the redirect URI above into Callback URI / Redirect URL.",
      "Add any website URL into Website URL (X requires this even if unused).",
      "Save, then on the Keys and tokens tab, copy the OAuth 2.0 Client ID and Client Secret below.",
    ],
  },
  {
    key: "facebook",
    label: "Facebook",
    appLabel: "Meta app (Facebook + Instagram)",
    consoleUrl: "https://developers.facebook.com/apps",
    consoleHint: "Create a Business app; the same credentials power Facebook + Instagram.",
    setupSteps: [
      "Open the Meta developers console and create a Business-type app.",
      "Add the Facebook Login for Business product.",
      "Under Settings > Basic, paste the redirect URI above into Valid OAuth Redirect URIs and App Domains.",
      "Request pages_show_list, pages_manage_posts, and pages_read_engagement permissions.",
      "Copy the App ID (Client ID) and App Secret (Client Secret) from Settings > Basic.",
    ],
  },
  {
    key: "instagram",
    label: "Instagram",
    appLabel: "Meta app (Facebook + Instagram)",
    consoleUrl: "https://developers.facebook.com/apps",
    consoleHint: "Create a Business app; the same credentials power Facebook + Instagram.",
    connectHint:
      "Connects via Facebook - Use Instagram Business account linked to your Facebook Page.",
    setupSteps: [
      "Reuse the Meta app you set up for Facebook (same App ID + Secret).",
      "Confirm the Instagram Business account is linked to a Facebook Page you admin.",
      "Add instagram_basic, instagram_content_publish, pages_show_list, and pages_read_engagement permissions.",
      "Paste the same redirect URI above into Valid OAuth Redirect URIs.",
    ],
  },
]

type Account = WithId<SocialAccountPublic>

type Props = {
  accounts: Account[]
  configuredChannels: ChannelKey[]
  redirectUriByChannel: Record<ChannelKey, string>
  isAdmin: boolean
}

export function ChannelsManager({
  accounts,
  configuredChannels,
  redirectUriByChannel,
  isAdmin,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const configured = new Set(configuredChannels)

  function onDisconnect(id: string) {
    setBusyId(id)
    startTransition(async () => {
      const res = await disconnectAccount(id)
      if (res.ok) toast.success("Channel disconnected")
      else toast.error(res.error ?? "Could not disconnect")
      setBusyId(null)
      router.refresh()
    })
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {CHANNELS.map((ch) => {
        const linked = accounts.filter((a) => a.channel === ch.key)
        const isConfigured = configured.has(ch.key)
        return (
          <div key={ch.key} className="rounded-xl border border-border bg-canvas p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium">{ch.label}</h2>
              <div className="flex items-center gap-2">
                {isAdmin && isConfigured && (
                  <SetupDialog
                    channel={ch}
                    redirectUri={redirectUriByChannel[ch.key]}
                    isConfigured
                    onSaved={() => router.refresh()}
                  />
                )}
                {isConfigured ? (
                  <a
                    href={`/api/social/${ch.key}/connect`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    <Link2 aria-hidden />
                    {linked.length > 0 ? "Connect another" : "Connect"}
                  </a>
                ) : isAdmin ? (
                  <SetupDialog
                    channel={ch}
                    redirectUri={redirectUriByChannel[ch.key]}
                    isConfigured={false}
                    onSaved={() => router.refresh()}
                  />
                ) : null}
              </div>
            </div>

            {!isConfigured && (
              <p className="mt-3 text-xs text-muted-foreground">
                {isAdmin
                  ? "Add this channel's OAuth credentials once to enable connecting."
                  : "Not yet set up. Ask an admin to add OAuth credentials."}
              </p>
            )}

            {isConfigured && linked.length === 0 && (
              <p className="mt-3 text-xs text-muted-foreground">Not connected.</p>
            )}

            {ch.connectHint && linked.length === 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground/80">{ch.connectHint}</p>
            )}

            {linked.length > 0 && (
              <ul className="mt-3 space-y-2">
                {linked.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{a.displayName}</p>
                      {a.status === "needs_reauth" ? (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-amber-600">
                          <AlertTriangle aria-hidden className="size-3" />
                          Reconnect needed
                        </span>
                      ) : (
                        <Badge variant="secondary" className="mt-0.5 text-[10px]">
                          Active
                        </Badge>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {a.status === "needs_reauth" && (
                        <a
                          href={`/api/social/${ch.key}/connect`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        >
                          Re-auth
                        </a>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending && busyId === a.id}
                        onClick={() => onDisconnect(a.id)}
                      >
                        <Unplug aria-hidden />
                        Disconnect
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SetupDialog({
  channel,
  redirectUri,
  isConfigured,
  onSaved,
}: {
  channel: ChannelDef
  redirectUri: string
  isConfigured: boolean
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [copied, setCopied] = useState(false)
  const [saving, startSaving] = useTransition()

  function onCopyRedirect() {
    navigator.clipboard.writeText(redirectUri).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    startSaving(async () => {
      const res = await setPlatformOauthApp(channel.key, clientId, clientSecret)
      if (res.ok) {
        toast.success(`${channel.label} is ready to connect`)
        setClientId("")
        setClientSecret("")
        setOpen(false)
        onSaved()
      } else {
        toast.error(res.error ?? "Couldn't save credentials")
      }
    })
  }

  const formId = `${channel.key}-oauth-setup`

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant={isConfigured ? "ghost" : "outline"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Settings2 aria-hidden />
        {isConfigured ? "Edit" : "Set up"}
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isConfigured ? "Edit" : "Set up"} {channel.appLabel}</DialogTitle>
          <DialogDescription>
            One-time setup. Once saved, anyone in your org can click Connect.
          </DialogDescription>
        </DialogHeader>
        <form id={formId} onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Redirect URI
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <code className="block min-w-0 flex-1 break-all rounded bg-background px-2 py-1.5 text-[11px]">
                {redirectUri}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 sm:self-start"
                onClick={onCopyRedirect}
              >
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Paste this exactly into your{" "}
              <a
                href={channel.consoleUrl}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                {channel.appLabel.includes("Meta") ? "Meta" : channel.label} developer console
              </a>{" "}
              as the OAuth redirect URL. {channel.consoleHint}
            </p>
          </div>

          {channel.setupSteps && channel.setupSteps.length > 0 && (
            <div className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Where to find these
              </Label>
              <ol className="ml-4 list-decimal space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                {channel.setupSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor={`${channel.key}-client-id`}>Client ID</Label>
            <Input
              id={`${channel.key}-client-id`}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={isConfigured ? "Leave blank to keep current" : ""}
              autoComplete="off"
              required={!isConfigured}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${channel.key}-client-secret`}>Client secret</Label>
            <Input
              id={`${channel.key}-client-secret`}
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={isConfigured ? "Leave blank to keep current" : ""}
              autoComplete="off"
              required={!isConfigured}
            />
            <p className="text-[11px] text-muted-foreground">
              Stored AES-256-GCM encrypted in Firestore. Never logged or returned to the browser.
            </p>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
