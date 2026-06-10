"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

export function DevAuthShortcuts({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <div className="mt-4 space-y-2 border-t border-border pt-4">
      <p className="text-center text-xs text-muted-foreground">
        Emulator shortcuts
      </p>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={pending}
        onClick={() => {
          startTransition(() => {
            router.replace(mode === "signup" ? "/workspaces?new=1" : "/workspaces")
          })
        }}
      >
        {pending
          ? "Loading…"
          : mode === "signup"
            ? "Sign up (emulator)"
            : "Sign in (emulator)"}
      </Button>
    </div>
  )
}
