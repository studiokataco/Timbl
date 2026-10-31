"use client"

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, Loader2, Lock } from "lucide-react"
import { toast } from "sonner"

import { AuthCard } from "@/components/auth/auth-card"
import { GoogleAuthButton } from "@/components/auth/google-auth-button"
import { GoogleIcon } from "@/components/auth/google-icon"
import { PolicyAcceptance } from "@/components/auth/policy-acceptance"
import {
  PricingCard,
  TIER_HEX,
  tierButtonBackground,
  tierTint,
  type PricingTier,
} from "@/components/marketing/pricing-card"
import { recordAccountConsent } from "@/lib/actions/record-consent"
import { getPublicCheckoutStatus, startPublicCheckout } from "@/lib/actions/checkout"
import { activateWorkspaceClient } from "@/lib/auth/activate-workspace-client"
import { loadCheckout } from "@/lib/billing/razorpay-checkout"
import { cn } from "@/lib/utils"

const PENDING_KEY = "timbl.checkout.subscription"
const POLL_MS = 2000
const POLL_LIMIT = 45

type Phase =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "activating"; stage: "workspace" | "opening" }
  | { kind: "slow" }
  | { kind: "failed"; message: string }

export function CheckoutFlow({
  planId,
  planLabel,
  priceLabel,
  tier,
  signedInEmail,
  hasWorkspace,
}: {
  planId: string
  planLabel: string
  priceLabel: string
  tier: PricingTier
  signedInEmail: string | null
  hasWorkspace: boolean
}) {
  const router = useRouter()
  const [accepted, setAccepted] = useState(false)
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const signedIn = Boolean(signedInEmail)
  const tint = tierTint(planId) ?? "255,255,255"
  const accent = TIER_HEX[planId] ?? "#ffffff"

  const stopPolling = () => {
    if (pollRef.current) clearTimeout(pollRef.current)
    pollRef.current = null
  }

  const watch = useCallback(
    (subscriptionId: string) => {
      stopPolling()
      setPhase({ kind: "activating", stage: "workspace" })
      let attempts = 0

      const tick = async () => {
        attempts += 1
        const status = await getPublicCheckoutStatus(subscriptionId).catch(() => null)
        if (status?.state === "ready") {
          sessionStorage.removeItem(PENDING_KEY)
          setPhase({ kind: "activating", stage: "opening" })
          try {
            const { next } = await activateWorkspaceClient({
              organizationId: status.organizationId,
            })
            router.replace(next)
            router.refresh()
          } catch {
            router.replace("/login")
          }
          return
        }
        if (status?.state === "failed") {
          sessionStorage.removeItem(PENDING_KEY)
          setPhase({ kind: "failed", message: status.error })
          return
        }
        if (attempts >= POLL_LIMIT) {
          setPhase({ kind: "slow" })
          return
        }
        pollRef.current = setTimeout(tick, POLL_MS)
      }

      void tick()
    },
    [router],
  )

  useEffect(() => {
    if (!signedIn) return
    const pending = sessionStorage.getItem(PENDING_KEY)
    const resume = pending ? setTimeout(() => watch(pending), 0) : null
    return () => {
      if (resume) clearTimeout(resume)
      stopPolling()
    }
  }, [signedIn, watch])

  async function pay() {
    setPhase({ kind: "starting" })
    const res = await startPublicCheckout(planId)
    if (!res.ok) {
      setPhase({ kind: "failed", message: res.error })
      return
    }
    try {
      await loadCheckout()
    } catch {
      setPhase({ kind: "failed", message: "Razorpay didn't load. Check your connection and try again." })
      return
    }
    if (!window.Razorpay) {
      setPhase({ kind: "failed", message: "Razorpay didn't load. Check your connection and try again." })
      return
    }
    const checkout = new window.Razorpay({
      key: res.keyId,
      subscription_id: res.subscriptionId,
      name: "Timbl",
      description: `${planLabel} plan, billed monthly`,
      prefill: { email: signedInEmail ?? undefined },
      theme: { color: accent },
      handler: () => {
        sessionStorage.setItem(PENDING_KEY, res.subscriptionId)
        watch(res.subscriptionId)
      },
      modal: {
        ondismiss: () => {
          setPhase((current) => {
            if (current.kind !== "starting") return current
            toast.message("Payment not completed", { description: "You haven't been charged." })
            return { kind: "idle" }
          })
        },
      },
    })
    checkout.on("payment.failed", (event) => {
      setPhase({
        kind: "failed",
        message: event.error?.description ?? "The payment didn't go through. You haven't been charged.",
      })
    })
    checkout.open()
  }

  const busy = phase.kind === "starting"
  const working = phase.kind === "activating" || phase.kind === "slow"

  return (
    <div
      className="mx-auto grid w-full max-w-xl gap-6 lg:max-w-none lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10"
      style={{ "--tint": tint } as CSSProperties}
    >
      <AuthCard className="p-6 sm:p-10">
        {working ? null : (
          <Link
            href="/pricing"
            className="mb-6 inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft aria-hidden className="size-4" />
            All plans
          </Link>
        )}

        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          {working ? "Setting up your workspace" : `Buy ${planLabel}`}
        </h1>
        <p className="mt-2 max-w-prose text-[15px] text-pretty text-muted-foreground">
          {working
            ? "Payment received. This usually takes a few seconds."
            : `${priceLabel} a month, billed monthly. Cancel anytime from your workspace settings.`}
        </p>

        {working ? (
          <ActivationProgress phase={phase} email={signedInEmail} onRetry={() => {
            const pending = sessionStorage.getItem(PENDING_KEY)
            if (pending) watch(pending)
          }} />
        ) : (
          <ol className="mt-9 space-y-0">
            <Step
              index={1}
              state={signedIn ? "done" : "active"}
              title={signedIn ? "Signed in" : "Sign in with Google"}
              last={false}
            >
              {signedIn ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    <span className="text-foreground">{signedInEmail}</span>
                    {" · "}
                    <a
                      href="/auth/logout"
                      className="rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Not you?
                    </a>
                  </p>
                  {hasWorkspace ? (
                    <p className="rounded-lg bg-white/[0.04] px-3.5 py-3 text-sm leading-relaxed text-foreground/75 ring-1 ring-inset ring-white/10">
                      You already have a workspace. This creates a new one on {planLabel}. To
                      upgrade your current workspace instead, open{" "}
                      <Link
                        href="/settings/billing"
                        className="font-medium text-foreground underline underline-offset-4"
                      >
                        Plan and billing
                      </Link>
                      .
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Your new workspace is created under this account.
                  </p>
                  <PolicyAcceptance
                    id="checkout-terms"
                    checked={accepted}
                    onCheckedChange={setAccepted}
                  />
                  <GoogleAuthButton
                    intent="signup"
                    label="Continue with Google"
                    pendingLabel="Signing in…"
                    variant="outline"
                    className="h-11 w-full border-border bg-input/50 text-foreground hover:bg-input/70"
                    icon={<GoogleIcon />}
                    disabled={!accepted}
                    onAuthenticated={async (idToken) => {
                      await recordAccountConsent(idToken)
                    }}
                    onSignedIn={() => router.refresh()}
                  />
                </div>
              )}
            </Step>

            <Step
              index={2}
              state={signedIn ? "active" : "upcoming"}
              title={`Pay ${priceLabel}`}
              last
            >
              <p className={cn("text-sm", signedIn ? "text-muted-foreground" : "text-muted-foreground/60")}>
                Card, UPI or netbanking through Razorpay. Your workspace is created as soon as
                payment is confirmed.
              </p>
              {signedIn ? (
                <div className="mt-4 space-y-3">
                  {phase.kind === "failed" ? (
                    <p
                      role="alert"
                      className="rounded-lg bg-red-500/10 px-3.5 py-3 text-sm text-red-200 ring-1 ring-inset ring-red-500/25"
                    >
                      {phase.message}
                    </p>
                  ) : null}
                  <div className="rounded-2xl bg-[#101012] p-1.5 ring-1 ring-white/10">
                    <button
                      type="button"
                      onClick={() => void pay()}
                      disabled={busy}
                      className={cn(
                        "flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-[#0a0a0a]",
                        "ring-1 ring-[rgba(var(--tint),0.8)] shadow-[0_0_28px_-6px_rgba(var(--tint),0.7)]",
                        "transition-[filter,transform] hover:brightness-110 active:scale-[0.99] disabled:cursor-progress disabled:opacity-80",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#101012]",
                      )}
                      style={{ background: tierButtonBackground(planId) }}
                    >
                      {busy ? (
                        <Loader2 aria-hidden className="size-4 animate-spin" />
                      ) : (
                        <Lock aria-hidden className="size-4" />
                      )}
                      {busy ? "Opening Razorpay…" : phase.kind === "failed" ? "Try again" : `Pay ${priceLabel}`}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Payments are processed by Razorpay. Timbl never sees your card details.
                  </p>
                </div>
              ) : null}
            </Step>
          </ol>
        )}

        {working ? null : (
          <p className="mt-9 border-t border-white/10 pt-6 text-sm text-muted-foreground">
            Prefer to start free?{" "}
            <Link
              href={`/request-invite?plan=${planId}`}
              className="rounded-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Request free access
            </Link>
          </p>
        )}
      </AuthCard>

      <aside aria-label={`${planLabel} plan`} className="lg:sticky lg:top-10">
        <PricingCard tier={tier} showCta={false} />
      </aside>
    </div>
  )
}

function Step({
  index,
  state,
  title,
  last,
  children,
}: {
  index: number
  state: "done" | "active" | "upcoming"
  title: string
  last: boolean
  children: ReactNode
}) {
  return (
    <li
      className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-x-4 pb-8 last:pb-0"
      aria-current={state === "active" ? "step" : undefined}
    >
      {last ? null : (
        <span
          aria-hidden
          className={cn(
            "absolute top-9 bottom-1 left-[13.5px] w-px transition-colors duration-500",
            state === "done" ? "bg-[rgba(var(--tint),0.55)]" : "bg-white/10",
          )}
        />
      )}
      <span
        className={cn(
          "grid size-7 place-items-center rounded-full text-[13px] font-semibold transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          state === "done" && "bg-[rgb(var(--tint))] text-[#0a0a0a]",
          state === "active" && "text-foreground ring-2 ring-[rgba(var(--tint),0.85)] shadow-[0_0_18px_-4px_rgba(var(--tint),0.8)]",
          state === "upcoming" && "text-muted-foreground/60 ring-1 ring-white/15",
        )}
      >
        {state === "done" ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : index}
        <span className="sr-only">{state === "done" ? "Completed: " : `Step ${index}: `}</span>
      </span>
      <div className="min-w-0 pt-0.5">
        <h2
          className={cn(
            "text-base font-semibold tracking-tight",
            state === "upcoming" ? "text-foreground/50" : "text-foreground",
          )}
        >
          {title}
        </h2>
        <div className="mt-2">{children}</div>
      </div>
    </li>
  )
}

function ActivationProgress({
  phase,
  email,
  onRetry,
}: {
  phase: Phase
  email: string | null
  onRetry: () => void
}) {
  const stage = phase.kind === "activating" ? phase.stage : "workspace"
  const rows: { label: string; state: "done" | "active" | "upcoming" }[] = [
    { label: "Payment confirmed", state: "done" },
    { label: "Workspace created", state: stage === "opening" ? "done" : "active" },
    { label: "Opening Timbl", state: stage === "opening" ? "active" : "upcoming" },
  ]

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-9 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-500"
    >
      <ul className="space-y-4">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-3.5 text-[15px]">
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full transition-colors duration-500",
                row.state === "done" && "bg-[rgb(var(--tint))] text-[#0a0a0a]",
                row.state === "active" && "text-foreground",
                row.state === "upcoming" && "ring-1 ring-white/15",
              )}
            >
              {row.state === "done" ? (
                <Check aria-hidden className="size-3.5" strokeWidth={3} />
              ) : row.state === "active" && phase.kind === "activating" ? (
                <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
              ) : null}
            </span>
            <span className={row.state === "upcoming" ? "text-muted-foreground/60" : "text-foreground"}>
              {row.label}
            </span>
          </li>
        ))}
      </ul>

      {phase.kind === "slow" ? (
        <div className="mt-8 space-y-4 rounded-lg bg-white/[0.04] px-4 py-4 text-sm leading-relaxed text-foreground/80 ring-1 ring-inset ring-white/10">
          <p>
            Your payment went through, but the workspace is taking longer than usual. We&apos;ll
            email {email ?? "you"} as soon as it&apos;s ready, or you can check again now.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <button
              type="button"
              onClick={onRetry}
              className="rounded-sm font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Check again
            </button>
            <Link
              href="/login"
              className="rounded-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Sign in later
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
