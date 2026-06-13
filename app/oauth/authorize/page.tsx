"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Shield, CheckCircle } from "lucide-react"

import { Button } from "@/components/ui/button"

const SCOPE_LABELS: Record<string, string> = {
  "posts:read": "Read posts",
  "posts:write": "Create and edit posts",
  "posts:publish": "Publish posts to channels",
  "ideation:read": "Read ideation items",
  "ideation:write": "Create and manage ideas",
  "approvals:read": "View approval requests",
  "approvals:request": "Request post approvals",
  "metrics:read": "Read publishing metrics",
  "channels:read": "List connected channels",
  "categories:read": "List content categories",
  "webhooks:write": "Create webhook subscriptions",
  "inbox:read": "Read inbox conversations",
}

export default function OAuthAuthorizePage() {
  return (
    <Suspense fallback={null}>
      <OAuthAuthorizeInner />
    </Suspense>
  )
}

function OAuthAuthorizeInner() {
  const params = useSearchParams()
  const router = useRouter()

  const clientId = params.get("client_id") ?? ""
  const orgId = params.get("org_id") ?? ""
  const redirectUri = params.get("redirect_uri") ?? ""
  const scopeParam = params.get("scope") ?? ""
  const state = params.get("state") ?? ""
  const codeChallenge = params.get("code_challenge") ?? ""

  const scopes = scopeParam.split(" ").filter(Boolean)

  const [appName, setAppName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!clientId || !orgId) {
      setError("Invalid authorization request.")
      return
    }
    fetch(
      `/api/oauth/authorize?client_id=${encodeURIComponent(clientId)}&org_id=${encodeURIComponent(orgId)}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError("Unknown application.")
        else setAppName(data.name as string)
      })
      .catch(() => setError("Could not load application details."))
  }, [clientId, orgId])

  async function handleApprove() {
    setLoading(true)
    try {
      const res = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          redirectUri,
          scopes,
          state,
          codeChallenge,
          codeChallengeMethod: "S256",
        }),
      })
      const data = (await res.json()) as { redirectTo?: string; error?: string }
      if (!res.ok || !data.redirectTo) {
        setError(data.error ?? "Authorization failed.")
        setLoading(false)
        return
      }
      router.push(data.redirectTo)
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  function handleDeny() {
    const redirect = new URL(redirectUri)
    redirect.searchParams.set("error", "access_denied")
    redirect.searchParams.set("state", state)
    router.push(redirect.toString())
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa] p-4">
        <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm ring-1 ring-[#e5e7eb]">
          <p className="text-sm text-[#ef4444]">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa] p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm ring-1 ring-[#e5e7eb]">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#111111]">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-[#6b7280]">Authorization request</p>
            <p className="text-sm font-semibold text-[#111111]">
              {appName ?? "Loading..."}
            </p>
          </div>
        </div>

        <p className="mb-5 text-sm text-[#374151]">
          <span className="font-medium text-[#111111]">{appName}</span> wants to
          access your Timbl workspace.
        </p>

        <div className="mb-6 rounded-lg bg-[#f5f5f5] px-4 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#6b7280]">
            Permissions requested
          </p>
          <ul className="space-y-1.5">
            {scopes.map((scope) => (
              <li key={scope} className="flex items-center gap-2 text-sm text-[#374151]">
                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-[#10b981]" />
                {SCOPE_LABELS[scope] ?? scope}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleDeny}
            disabled={loading}
          >
            Deny
          </Button>
          <Button
            className="flex-1 bg-[#111111] text-white hover:bg-[#242424]"
            onClick={handleApprove}
            disabled={loading || !appName}
          >
            {loading ? "Authorizing..." : "Allow access"}
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-[#6b7280]">
          You can revoke access anytime from Settings - Integrations.
        </p>
      </div>
    </div>
  )
}
