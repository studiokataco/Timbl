"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Lock, User } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { AuthFloatingField } from "@/components/auth/auth-floating-field"
import { DevAuthShortcuts } from "@/components/auth/dev-auth-shortcuts"
import { GoogleAuthButton } from "@/components/auth/google-auth-button"
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

function GoogleIcon() {
  return (
    <svg className="mr-2 h-5 w-5" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L38.802 8.841C34.553 4.806 29.613 2.5 24 2.5C11.983 2.5 2.5 11.983 2.5 24s9.483 21.5 21.5 21.5S45.5 36.017 45.5 24c0-1.538-.135-3.022-.389-4.417z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12.5 24 12.5c3.059 0 5.842 1.154 7.961 3.039l5.839-5.841C34.553 4.806 29.613 2.5 24 2.5C16.318 2.5 9.642 6.723 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 45.5c5.613 0 10.553-2.306 14.802-6.341l-5.839-5.841C30.842 35.846 27.059 38 24 38c-5.039 0-9.345-2.608-11.124-6.481l-6.571 4.819C9.642 41.277 16.318 45.5 24 45.5z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l5.839 5.841C44.196 35.123 45.5 29.837 45.5 24c0-1.538-.135-3.022-.389-4.417z"
      />
    </svg>
  )
}

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
      const result = await completeAuthCallback({
        user: cred.user,
        intent: "signin",
        nextParam: search.get("next"),
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
    <div className="space-y-6 rounded-xl border border-border bg-card/10 p-8 shadow-2xl backdrop-blur-lg">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to continue</p>
      </div>

      <form
        className="space-y-8"
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
            className="text-xs text-muted-foreground transition hover:text-foreground"
            onClick={() => setShowForgot((v) => !v)}
          >
            Forgot password?
          </button>
        </div>

        {showForgot ? (
          <div className="rounded-lg border border-border bg-card/20 p-3">
            <p className="mb-2 text-xs text-muted-foreground">
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
          disabled={isSubmitting}
          className="group h-11 w-full text-base"
          size="lg"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
          <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Button>

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-border" />
          <span className="mx-4 shrink-0 text-xs text-muted-foreground">
            Or continue with
          </span>
          <div className="flex-grow border-t border-border" />
        </div>

        <GoogleAuthButton
          intent="signin"
          label="Sign in with Google"
          pendingLabel="Signing in…"
          variant="outline"
          icon={<GoogleIcon />}
        />
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-semibold text-brand-accent hover:text-brand-accent/80"
        >
          Sign up
        </Link>
      </p>

      {IS_DEV_SHIM ? <DevAuthShortcuts mode="signin" /> : null}
    </div>
  )
}
