"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Lock, User } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { FirebaseError } from "firebase/app"

import { AuthCard } from "@/components/auth/auth-card"
import { AuthFloatingField } from "@/components/auth/auth-floating-field"
import { DevAuthShortcuts } from "@/components/auth/dev-auth-shortcuts"
import { GoogleAuthButton } from "@/components/auth/google-auth-button"
import { Button } from "@/components/ui/button"
import { IS_DEV_SHIM } from "@/lib/auth/dev-session"
import { mapFirebaseAuthError, signUpWithEmail } from "@/lib/auth/email-auth"
import { completeAuthCallback } from "@/lib/auth/post-auth-callback"
import { signUpSchema, type SignUpInput } from "@/lib/schemas/auth"

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

export function SignUpForm() {
  return (
    <Suspense fallback={null}>
      <SignUpFormInner />
    </Suspense>
  )
}

function SignUpFormInner() {
  const router = useRouter()
  const search = useSearchParams()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>()

  async function onSubmit(data: SignUpInput) {
    try {
      const cred = await signUpWithEmail(data.email, data.password, data.name)
      const result = await completeAuthCallback({
        user: cred.user,
        intent: "signup",
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

  return (
    <AuthCard className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign up to get started
        </p>
      </div>

      <form
        className="space-y-6"
        onSubmit={handleSubmit((values) => {
          const parsed = signUpSchema.safeParse(values)
          if (!parsed.success) {
            const issue = parsed.error.issues[0]
            setError((issue?.path[0] as keyof SignUpInput) ?? "email", {
              message: issue?.message ?? "Invalid input",
            })
            return
          }
          void onSubmit(parsed.data)
        })}
      >
        <AuthFloatingField
          id="signup_name"
          label="Name"
          icon={User}
          type="text"
          autoComplete="name"
          error={errors.name}
          {...register("name")}
        />
        <AuthFloatingField
          id="signup_email"
          label="Email address"
          icon={User}
          type="email"
          autoComplete="email"
          error={errors.email}
          {...register("email")}
        />
        <AuthFloatingField
          id="signup_password"
          label="Password"
          icon={Lock}
          type="password"
          autoComplete="new-password"
          error={errors.password}
          {...register("password")}
        />
        <AuthFloatingField
          id="signup_confirm"
          label="Confirm password"
          icon={Lock}
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword}
          {...register("confirmPassword")}
        />

        <Button
          type="submit"
          disabled={isSubmitting}
          className="group h-11 w-full text-base"
          size="lg"
        >
          {isSubmitting ? "Creating account…" : "Sign up"}
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
          intent="signup"
          label="Sign up with Google"
          pendingLabel="Signing up…"
          variant="outline"
          className="h-11 w-full border-border bg-input/50 text-foreground hover:bg-input/70"
          icon={<GoogleIcon />}
        />
      </form>

      <p className="text-center text-sm text-foreground/75">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-sky-400 hover:text-sky-300"
        >
          Sign in
        </Link>
      </p>

      {IS_DEV_SHIM ? <DevAuthShortcuts mode="signup" /> : null}
    </AuthCard>
  )
}
