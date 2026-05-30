"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { signInWithGoogleAccount } from "@/lib/auth/google-sign-in"
import { getClientAuth } from "@/lib/firebase/client"

const ALLOWED_DOMAINS = ["safefoundation.org.uk", "kataco.in"]

export function LoginForm() {
  const router = useRouter()
  const search = useSearchParams()
  const [pending, setPending] = useState(false)

  async function onSignIn() {
    if (pending) return
    setPending(true)
    try {
      const auth = getClientAuth()
      const result = await signInWithGoogleAccount()
      const email = result.user.email?.toLowerCase() ?? ""
      const domain = email.split("@")[1]
      if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
        await auth.signOut()
        toast.error("This Google account isn't authorised for this workspace.")
        return
      }
      const post = async (forceRefresh: boolean) => {
        const idToken = await result.user.getIdToken(forceRefresh)
        const res = await fetch("/auth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          refresh?: boolean
          accessPending?: boolean
          error?: string
        }
        if (data.accessPending) {
          await auth.signOut()
          router.replace("/access-pending")
          return { done: true as const }
        }
        if (!res.ok) {
          await auth.signOut()
          throw new Error(data.error || "Session creation failed")
        }
        return { refresh: data.refresh, done: false as const }
      }
      /* Pass 1 - server provisions membership + sets custom claims. */
      const first = await post(true)
      if (first.done) return
      if (first.refresh) {
        const second = await post(true)
        if (second.done) return
        if (second.refresh) throw new Error("Session not minted after claim refresh")
      }
      const next = search.get("next") ?? "/calendar"
      router.replace(next)
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed"
      toast.error(message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Button onClick={onSignIn} disabled={pending} className="w-full" size="lg">
      {pending ? "Signing in…" : "Continue with Google"}
    </Button>
  )
}
