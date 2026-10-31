"use client"

import { useState, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { BrandGlowButton } from "@/components/ui/brand-glow-button"
import { Button } from "@/components/ui/button"
import type { AuthIntent } from "@/lib/auth/intent"
import { signInWithGoogleAccount } from "@/lib/auth/google-sign-in"
import { completeAuthCallback } from "@/lib/auth/post-auth-callback"

export function GoogleAuthButton({
  intent,
  label,
  pendingLabel,
  signingInLabel = "Signing in…",
  variant = "default",
  glow = false,
  icon,
  className,
  disabled = false,
  onAuthenticated,
  onSignedIn,
}: {
  intent: AuthIntent
  label: string
  pendingLabel: string
  signingInLabel?: string
  variant?: "default" | "outline"
  glow?: boolean
  icon?: ReactNode
  className?: string
  disabled?: boolean
  onAuthenticated?: (idToken: string) => Promise<void> | void
  /* Replaces the post-auth redirect, for flows that continue on the same page. */
  onSignedIn?: () => void
}) {
  const router = useRouter()
  const search = useSearchParams()
  const [pending, setPending] = useState(false)
  const [preparing, setPreparing] = useState(false)

  async function runAuth() {
    if (pending) return
    setPending(true)
    try {
      const result = await signInWithGoogleAccount()
      if (onAuthenticated) {
        await onAuthenticated(await result.user.getIdToken())
      }
      setPreparing(true)
      const callback = await completeAuthCallback({
        user: result.user,
        intent,
        nextParam: search.get("next"),
        onRetry: () => setPreparing(true),
      })
      if ("accessPending" in callback) {
        router.replace("/access-pending")
        return
      }
      if (onSignedIn) {
        onSignedIn()
        return
      }
      router.replace(callback.next)
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed"
      toast.error(message)
    } finally {
      setPending(false)
      setPreparing(false)
    }
  }

  const handleClick = () => {
    if (disabled) return
    void runAuth()
  }

  const content = (
    <>
      {icon}
      {pending ? (preparing ? pendingLabel : signingInLabel) : label}
    </>
  )

  if (glow) {
    return (
      <BrandGlowButton
        onClick={handleClick}
        disabled={pending || disabled}
        className="h-11 w-full text-base"
      >
        {content}
      </BrandGlowButton>
    )
  }

  return (
    <Button
      onClick={handleClick}
      disabled={pending || disabled}
      variant={variant}
      className={className ?? "w-full"}
      size="lg"
    >
      {content}
    </Button>
  )
}
