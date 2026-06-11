"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"

export function DevAuthShortcuts({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <div className="mt-4 space-y-2 border-t border-border pt-4">
      <p className="text-center text-xs font-medium text-foreground/70">
        Emulator shortcuts
      </p>
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full border-border bg-input/50 text-foreground hover:bg-input/70"
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
