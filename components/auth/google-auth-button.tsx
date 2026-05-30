"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { BrandGlowButton } from "@/components/ui/brand-glow-button"
import { Button } from "@/components/ui/button"
import type { AuthIntent } from "@/lib/auth/intent"
import { signInWithGoogleAccount } from "@/lib/auth/google-sign-in"
import { getClientAuth } from "@/lib/firebase/client"

export function GoogleAuthButton({
  intent,
  label,
  pendingLabel,
  variant = "default",
  glow = false,
}: {
  intent: AuthIntent
  label: string
  pendingLabel: string
  variant?: "default" | "outline"
  glow?: boolean
}) {
  const router = useRouter()
  const search = useSearchParams()
  const [pending, setPending] = useState(false)

  async function runAuth() {
    if (pending) return
    setPending(true)
    try {
      const auth = getClientAuth()
      const result = await signInWithGoogleAccount()

      const post = async (forceRefresh: boolean) => {
        const idToken = await result.user.getIdToken(forceRefresh)
        const res = await fetch("/auth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, intent }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          refresh?: boolean
          accessPending?: boolean
          next?: string
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
        return { refresh: data.refresh, next: data.next, done: false as const }
      }

      const first = await post(true)
      if (first.done) return
      if (first.refresh) {
        const second = await post(true)
        if (second.done) return
        if (second.refresh) throw new Error("Session not minted after claim refresh")
        const next = second.next ?? search.get("next") ?? defaultNext(intent)
        router.replace(next)
        router.refresh()
        return
      }

      const next = first.next ?? search.get("next") ?? defaultNext(intent)
      router.replace(next)
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed"
      toast.error(message)
    } finally {
      setPending(false)
    }
  }

  const handleClick = () => {
    void runAuth()
  }

  if (glow) {
    return (
      <BrandGlowButton
        onClick={handleClick}
        disabled={pending}
        className="h-11 w-full text-base"
      >
        {pending ? pendingLabel : label}
      </BrandGlowButton>
    )
  }

  return (
    <Button
      onClick={handleClick}
      disabled={pending}
      variant={variant}
      className="w-full"
      size="lg"
    >
      {pending ? pendingLabel : label}
    </Button>
  )
}

function defaultNext(intent: AuthIntent) {
  return intent === "signup" ? "/workspaces?new=1" : "/calendar"
}
