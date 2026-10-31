"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Lock, User } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { AuthCard } from "@/components/auth/auth-card"
import { AuthFloatingField } from "@/components/auth/auth-floating-field"
import { DevAuthShortcuts } from "@/components/auth/dev-auth-shortcuts"
import { GoogleAuthButton } from "@/components/auth/google-auth-button"
import { GoogleIcon } from "@/components/auth/google-icon"
import { Button } from "@/components/ui/button"
import { IS_DEV_SHIM } from "@/lib/auth/dev-session"
import {
  mapFirebaseAuthError,
  sendPasswordReset,
  signInWithEmail,
} from "@/lib/auth/email-auth"
import { completeAuthCallback } from "@/lib/auth/post-auth-callback"
import { signInSchema, type SignInInput } from "@/lib/schemas/auth"
import { FirebaseError } from "firebase/app"

export function SignInForm() {
  return (
    <Suspense fallback={null}>
      <SignInFormInner />
    </Suspense>
  )
}

function SignInFormInner() {
  const router = useRouter()
  const search = useSearchParams()
  const [showForgot, setShowForgot] = useState(false)
  const [resetPending, setResetPending] = useState(false)
  const [preparing, setPreparing] = useState(false)

  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>()

  async function onSubmit(data: SignInInput) {
    try {
      const cred = await signInWithEmail(data.email, data.password)
      setPreparing(true)
      const result = await completeAuthCallback({
        user: cred.user,
        intent: "signin",
        nextParam: search.get("next"),
        onRetry: () => setPreparing(true),
      })
      if ("accessPending" in result) {
        router.replace("/access-pending")
        return
      }
      router.replace(result.next)
      router.refresh()
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : ""
      toast.error(mapFirebaseAuthError(code))
    } finally {
      setPreparing(false)
    }
  }

  async function onForgotPassword() {
    const email = getValues("email")
    if (!email) {
      toast.error("Enter your email above first")
      return
    }
    setResetPending(true)
    try {
      await sendPasswordReset(email)
      toast.success("Password reset email sent")
      setShowForgot(false)
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : ""
      toast.error(mapFirebaseAuthError(code))
    } finally {
      setResetPending(false)
    }
  }

  return (
    <AuthCard className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to continue</p>
      </div>

      <form
        className="space-y-5"
        onSubmit={handleSubmit((values) => {
          const parsed = signInSchema.safeParse(values)
          if (!parsed.success) {
            const issue = parsed.error.issues[0]
            setError((issue?.path[0] as keyof SignInInput) ?? "email", {
              message: issue?.message ?? "Invalid input",
            })
            return
          }
          void onSubmit(parsed.data)
        })}
      >
        <AuthFloatingField
          id="signin_email"
          label="Email address"
          icon={User}
          type="email"
          autoComplete="email"
          error={errors.email}
          {...register("email")}
        />
        <AuthFloatingField
          id="signin_password"
          label="Password"
          icon={Lock}
          type="password"
          autoComplete="current-password"
          error={errors.password}
          {...register("password")}
        />

        <div className="flex items-center justify-between">
          <button
            type="button"
            className="text-xs text-foreground/75 transition hover:text-foreground"
            onClick={() => setShowForgot((v) => !v)}
          >
            Forgot password?
          </button>
        </div>

        {showForgot ? (
          <div className="rounded-lg border border-border bg-input/40 p-3">
            <p className="mb-2 text-xs text-foreground/75">
              We will email a reset link to the address above.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={resetPending}
              onClick={() => void onForgotPassword()}
            >
              {resetPending ? "Sending…" : "Send reset email"}
            </Button>
          </div>
        ) : null}

        <Button
          type="submit"
          disabled={isSubmitting || preparing}
          className="group h-11 w-full text-base"
          size="lg"
        >
          {preparing
            ? "Getting things ready…"
            : isSubmitting
              ? "Signing in…"
              : "Sign in"}
          <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Button>

        <div className="relative flex items-center py-1">
          <div className="grow border-t border-border" />
          <span className="mx-4 shrink-0 text-xs text-foreground/65">
            Or continue with
          </span>
          <div className="grow border-t border-border" />
        </div>

        <GoogleAuthButton
          intent="signin"
          label="Sign in with Google"
          pendingLabel="Getting things ready…"
          signingInLabel="Signing in…"
          variant="outline"
          className="h-11 w-full border-border bg-input/50 text-foreground hover:bg-input/70"
          icon={<GoogleIcon />}
        />
      </form>

      <p className="text-center text-sm text-foreground/75">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-semibold text-sky-400 hover:text-sky-300"
        >
          Sign up
        </Link>
      </p>

      {IS_DEV_SHIM ? <DevAuthShortcuts mode="signin" /> : null}
    </AuthCard>
  )
}
