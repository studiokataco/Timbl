"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { AuthCard } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"
import { signInWithGoogleAccount } from "@/lib/auth/google-sign-in"
import { getClientAuth } from "@/lib/firebase/client"

type ControlAuthResult = {
  ok?: boolean
  refresh?: boolean
  next?: string
  error?: string
}

async function postControlAuth(idToken: string) {
  const res = await fetch("/api/control/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  })
  const data = (await res.json().catch(() => ({}))) as ControlAuthResult
  return { res, data }
}

export function ControlSignIn() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function runAuth() {
    if (pending) return
    setPending(true)
    try {
      const cred = await signInWithGoogleAccount()

      const run = async () => {
        const idToken = await cred.user.getIdToken(true)
        const { res, data } = await postControlAuth(idToken)
        if (!res.ok) {
          await getClientAuth().signOut()
          throw new Error(data.error || "Sign in failed")
        }
        return data
      }

      let result = await run()
      if (result.refresh) {
        result = await run()
        if (result.refresh) throw new Error("Session not minted after claim refresh")
      }

      router.replace(result.next ?? "/dashboard")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-16">
      <AuthCard className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-foreground text-background">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
              Control centre
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Platform admins only. Sign in to continue.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="lg"
          className="h-11 w-full text-base"
          disabled={pending}
          onClick={() => void runAuth()}
        >
          {pending ? "Signing in…" : "Sign in with Google"}
        </Button>
      </AuthCard>
    </div>
  )
}
