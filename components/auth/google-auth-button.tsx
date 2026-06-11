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
  variant = "default",
  glow = false,
  icon,
  className,
}: {
  intent: AuthIntent
  label: string
  pendingLabel: string
  variant?: "default" | "outline"
  glow?: boolean
  icon?: ReactNode
  className?: string
}) {
  const router = useRouter()
  const search = useSearchParams()
  const [pending, setPending] = useState(false)

  async function runAuth() {
    if (pending) return
    setPending(true)
    try {
      const result = await signInWithGoogleAccount()
      const callback = await completeAuthCallback({
        user: result.user,
        intent,
        nextParam: search.get("next"),
      })
      if ("accessPending" in callback) {
        router.replace("/access-pending")
        return
      }
      router.replace(callback.next)
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

  const content = (
    <>
      {icon}
      {pending ? pendingLabel : label}
    </>
  )

  if (glow) {
    return (
      <BrandGlowButton
        onClick={handleClick}
        disabled={pending}
        className="h-11 w-full text-base"
      >
        {content}
      </BrandGlowButton>
    )
  }

  return (
    <Button
      onClick={handleClick}
      disabled={pending}
      variant={variant}
      className={className ?? "w-full"}
      size="lg"
    >
      {content}
    </Button>
  )
}
