"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Building2, CheckCircle, Mail, MessageSquare, User } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { AuthCard } from "@/components/auth/auth-card"
import { AuthFloatingField } from "@/components/auth/auth-floating-field"
import { PolicyAcceptance } from "@/components/auth/policy-acceptance"
import { Button } from "@/components/ui/button"
import { submitInviteRequest } from "@/lib/actions/request-invite"
import { signupRequestFormSchema, type SignupRequestFormInput } from "@/lib/schemas/signupRequest"

export function RequestInviteForm() {
  const [submitted, setSubmitted] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [acceptError, setAcceptError] = useState<string>()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupRequestFormInput>()

  async function onSubmit(data: SignupRequestFormInput) {
    const parsed = signupRequestFormSchema.safeParse({ ...data, acceptedTerms: accepted })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      if (issue?.path[0] === "acceptedTerms") {
        setAcceptError(issue.message)
        return
      }
      setError((issue?.path[0] as keyof SignupRequestFormInput) ?? "email", {
        message: issue?.message ?? "Invalid input",
      })
      return
    }
    setAcceptError(undefined)
    const result = await submitInviteRequest(parsed.data)
    if (!result.ok) {
      toast.error(result.error ?? "Something went wrong. Try again.")
      return
    }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <AuthCard className="space-y-6 text-center">
        <CheckCircle className="mx-auto size-10 text-green-500" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Request received</h1>
          <p className="mt-2 text-sm text-foreground/75">
            We will review your request and email you when you are approved. Usually within 1-2 business days.
          </p>
        </div>
        <Link href="/login" className="inline-flex">
          <Button variant="outline" className="border-border bg-input/50 hover:bg-input/70">
            Back to sign in
          </Button>
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Request early access
        </h1>
        <p className="mt-2 text-sm text-foreground/75">
          Timbl is in closed beta. Tell us about yourself and we will be in touch.
        </p>
      </div>

      <form
        className="space-y-5"
        onSubmit={handleSubmit((values) => void onSubmit(values))}
      >
        <AuthFloatingField
          id="invite_name"
          label="Your name"
          icon={User}
          type="text"
          autoComplete="name"
          error={errors.name}
          {...register("name")}
        />
        <AuthFloatingField
          id="invite_email"
          label="Work email"
          icon={Mail}
          type="email"
          autoComplete="email"
          error={errors.email}
          {...register("email")}
        />
        <AuthFloatingField
          id="invite_company"
          label="Company or agency (optional)"
          icon={Building2}
          type="text"
          autoComplete="organization"
          error={errors.company}
          {...register("company")}
        />

        <div className="space-y-1.5">
          <label htmlFor="invite_usecase" className="text-sm font-medium text-foreground">
            How will you use Timbl? (optional)
          </label>
          <div className="relative">
            <MessageSquare
              aria-hidden
              className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground"
            />
            <textarea
              id="invite_usecase"
              rows={3}
              placeholder="e.g. Manage social media for 5 clients..."
              className="flex w-full resize-none rounded-lg border border-border bg-[var(--auth-field)] px-3 py-2.5 pl-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/25"
              {...register("useCase")}
            />
          </div>
          {errors.useCase?.message ? (
            <p className="text-xs text-destructive">{errors.useCase.message}</p>
          ) : null}
        </div>

        <PolicyAcceptance
          id="invite_accept_terms"
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
          {isSubmitting ? "Sending request..." : "Request access"}
          <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
        </Button>
      </form>

      <p className="text-center text-sm text-foreground/75">
        Already approved?{" "}
        <Link href="/login" className="font-semibold text-sky-400 hover:text-sky-300">
          Sign in
        </Link>
      </p>
    </AuthCard>
  )
}
