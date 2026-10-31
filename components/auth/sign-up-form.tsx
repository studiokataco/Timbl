"use client"

import { Suspense, useState } from "react"
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
import { GoogleIcon } from "@/components/auth/google-icon"
import { PolicyAcceptance } from "@/components/auth/policy-acceptance"
import { Button } from "@/components/ui/button"
import { IS_DEV_SHIM } from "@/lib/auth/dev-session"
import { recordAccountConsent } from "@/lib/actions/record-consent"
import { mapFirebaseAuthError, signUpWithEmail } from "@/lib/auth/email-auth"
import { completeAuthCallback } from "@/lib/auth/post-auth-callback"
import { signUpSchema, type SignUpInput } from "@/lib/schemas/auth"

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
  const [accepted, setAccepted] = useState(false)
  const [acceptError, setAcceptError] = useState<string>()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>()

  async function onSubmit(data: SignUpInput) {
    try {
      const cred = await signUpWithEmail(data.email, data.password, data.name)
      await recordAccountConsent(await cred.user.getIdToken())
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
          const parsed = signUpSchema.safeParse({ ...values, acceptedTerms: accepted })
          if (!parsed.success) {
            const issue = parsed.error.issues[0]
            if (issue?.path[0] === "acceptedTerms") {
              setAcceptError(issue.message)
              return
            }
            setError((issue?.path[0] as keyof SignUpInput) ?? "email", {
              message: issue?.message ?? "Invalid input",
            })
            return
          }
          setAcceptError(undefined)
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

        <PolicyAcceptance
          id="signup_accept_terms"
          checked={accepted}
          onCheckedChange={(value) => {
            setAccepted(value)
            if (value) setAcceptError(undefined)
          }}
          error={acceptError}
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
          disabled={!accepted}
          onAuthenticated={async (idToken) => {
            await recordAccountConsent(idToken)
          }}
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
