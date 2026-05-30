"use client"

import { Suspense, useTransition } from "react"
import { useRouter } from "next/navigation"
import { GoogleAuthButton } from "@/components/auth/google-auth-button"
import { Button } from "@/components/ui/button"

export function StartPage({ devShim }: { devShim: boolean }) {
  return (
    <main className="min-h-screen w-full grid place-items-center bg-background text-foreground p-6">
      <div className="w-full max-w-sm space-y-8">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">SAFE Planner</h1>
          <p className="text-sm text-muted-foreground">
            Sign up with Google, then create or open a workspace.
          </p>
        </header>

        <div className="space-y-3">
          {devShim ? (
            <DevSignUpButton />
          ) : (
            <Suspense fallback={null}>
              <GoogleAuthButton
                intent="signup"
                label="Sign up with Google"
                pendingLabel="Signing up…"
              />
            </Suspense>
          )}

          {devShim ? (
            <Suspense fallback={null}>
              <GoogleAuthButton
                intent="signin"
                label="Sign in with Google"
                pendingLabel="Signing in…"
                glow
              />
            </Suspense>
          ) : (
            <Suspense fallback={null}>
              <GoogleAuthButton
                intent="signin"
                label="Sign in with Google"
                pendingLabel="Signing in…"
                glow
              />
            </Suspense>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {devShim ? (
            <>
              Emulator: sign up skips Google and goes straight to workspace setup.
            </>
          ) : (
            <>
              New here? Use sign up to create a new workspace.
            </>
          )}
        </p>
      </div>
    </main>
  )
}

function DevSignUpButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      className="w-full"
      size="lg"
      disabled={pending}
      onClick={() => {
        startTransition(() => {
          router.replace("/workspaces?new=1")
        })
      }}
    >
      {pending ? "Signing up…" : "Sign up (emulator)"}
    </Button>
  )
}
