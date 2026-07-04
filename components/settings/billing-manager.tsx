"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  cancelSubscription,
  changePlan,
  createSubscription,
  startTrial,
  type SubscriptionStatus,
} from "@/lib/actions/billing"

const DOWNGRADE_REASONS = [
  "Too expensive",
  "Not using the features",
  "Missing a feature",
  "Switching tools",
  "Just testing",
  "Other",
] as const

type DowngradeTarget = {
  target: BillingPlanCard
  /* "switch" lowers to another paid tier; "cancel" drops to Free. */
  kind: "switch" | "cancel"
  losses: string[]
}

/* Serializable plan card - the server projects this from lib/plans/plans.ts
 * (prices are INR rupees). */
export type BillingPlanCard = {
  id: string
  label: string
  tier: string
  monthlyPriceInr: number | null
  perBrandPriceInr: number | null
  highlights: string[]
  billable: boolean
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js"

type CheckoutOptions = {
  key: string
  subscription_id: string
  name: string
  description?: string
  theme?: { color?: string }
  handler?: (res: unknown) => void
  modal?: { ondismiss?: () => void }
}

declare global {
  interface Window {
    Razorpay?: new (options: CheckoutOptions) => { open: () => void }
  }
}

function loadCheckout(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"))
    if (window.Razorpay) return resolve()
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`)
    if (existing) {
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () => reject(new Error("checkout failed to load")))
      return
    }
    const s = document.createElement("script")
    s.src = CHECKOUT_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error("checkout failed to load"))
    document.body.appendChild(s)
  })
}

function priceLabel(plan: BillingPlanCard): string {
  if (plan.monthlyPriceInr === null) return "Custom"
  if (plan.monthlyPriceInr === 0) return "Free"
  const base = `Rs ${plan.monthlyPriceInr.toLocaleString("en-IN")}/mo`
  return plan.perBrandPriceInr
    ? `${base} + Rs ${plan.perBrandPriceInr.toLocaleString("en-IN")}/brand`
    : base
}

const STATUS_TONE: Record<string, string> = {
  active: "bg-mint/20 text-foreground",
  trialing: "bg-yellow/20 text-foreground",
  past_due: "bg-coral/20 text-foreground",
  canceled: "bg-muted text-muted-foreground",
  manual: "bg-muted text-muted-foreground",
}

export function BillingManager({
  current,
  plans,
  paidCheckoutAvailable,
}: {
  current: SubscriptionStatus
  plans: BillingPlanCard[]
  paidCheckoutAvailable: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [busyPlan, setBusyPlan] = useState<string | null>(null)
  const [downgrade, setDowngrade] = useState<DowngradeTarget | null>(null)
  const hasActiveSub = Boolean(current.razorpaySubscriptionId) && current.status === "active"

  const currentPlan = plans.find((p) => p.id === current.planId) ?? null
  const pendingPlan =
    current.pendingPlanId && current.pendingPlanId !== current.planId && !hasActiveSub
      ? plans.find((p) => p.id === current.pendingPlanId) ?? null
      : null
  const currentPrice = currentPlan?.monthlyPriceInr ?? Number.POSITIVE_INFINITY
  const freePlan = plans.find((p) => !p.billable && p.monthlyPriceInr === 0) ?? null

  /* What the customer gives up moving from their plan down to `target` -
   * drives the loss-framing copy in the confirm dialog. */
  const lossesVs = (target: BillingPlanCard | null): string[] => {
    if (!currentPlan) return []
    const kept = new Set(target?.highlights ?? [])
    return currentPlan.highlights.filter((h) => !kept.has(h))
  }

  const confirmDowngrade = (reason: string, note: string) => {
    if (!downgrade) return
    const { target, kind } = downgrade
    setBusyPlan(target.id)
    start(async () => {
      const res =
        kind === "cancel"
          ? await cancelSubscription()
          : await changePlan(target.id, { reason, note: note || undefined })
      if (res.ok) {
        toast.success(
          kind === "cancel" ? "Subscription cancelled" : "Plan change requested",
          {
            description:
              "Access continues until the end of your current billing period.",
          },
        )
        setDowngrade(null)
        setTimeout(() => router.refresh(), 2500)
      } else {
        toast.error("Could not change plan", { description: res.error })
      }
      setBusyPlan(null)
    })
  }

  const subscribe = (plan: BillingPlanCard) => {
    setBusyPlan(plan.id)
    start(async () => {
      try {
        const res = await createSubscription(plan.id)
        if (!res.ok) {
          toast.error("Could not start checkout", { description: res.error })
          return
        }
        await loadCheckout()
        if (!window.Razorpay) {
          toast.error("Checkout unavailable", { description: "Razorpay failed to load" })
          return
        }
        const checkout = new window.Razorpay({
          key: res.keyId,
          subscription_id: res.subscriptionId,
          name: "Subscription",
          description: `${plan.label} plan`,
          theme: { color: "#1a1a1a" },
          handler: () => {
            toast.success("Payment received", {
              description: "Activating your plan - this updates in a moment.",
            })
            setTimeout(() => router.refresh(), 2500)
          },
          modal: { ondismiss: () => toast.message("Checkout closed") },
        })
        checkout.open()
      } catch (err) {
        toast.error("Checkout error", {
          description: err instanceof Error ? err.message : "unknown",
        })
      } finally {
        setBusyPlan(null)
      }
    })
  }

  const switchPlan = (plan: BillingPlanCard) => {
    setBusyPlan(plan.id)
    start(async () => {
      const res = await changePlan(plan.id)
      if (res.ok) {
        toast.success("Plan change requested", {
          description: "It applies once Razorpay confirms - status updates shortly.",
        })
        setTimeout(() => router.refresh(), 2500)
      } else {
        toast.error("Could not change plan", { description: res.error })
      }
      setBusyPlan(null)
    })
  }

  const beginTrial = () => {
    start(async () => {
      const res = await startTrial()
      if (res.ok) {
        toast.success("Trial started", {
          description: "You have 30 days of Agency features. No card required.",
        })
        setTimeout(() => router.refresh(), 1500)
      } else {
        toast.error("Could not start trial", { description: res.error })
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Current plan</p>
            <p className="text-lg font-medium">{current.planLabel}</p>
            {current.status === "trialing" && current.trialDaysLeft !== null ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Trial - {current.trialDaysLeft}{" "}
                {current.trialDaysLeft === 1 ? "day" : "days"} left. Subscribe to keep
                these features.
              </p>
            ) : null}
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium capitalize",
              STATUS_TONE[current.status] ?? "bg-muted text-muted-foreground",
            )}
          >
            {current.status.replace("_", " ")}
          </span>
          {hasActiveSub ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() =>
                setDowngrade({
                  target: freePlan ?? {
                    id: "free_v1",
                    label: "Free",
                    tier: "free",
                    monthlyPriceInr: 0,
                    perBrandPriceInr: null,
                    highlights: [],
                    billable: false,
                  },
                  kind: "cancel",
                  losses: lossesVs(freePlan),
                })
              }
              disabled={pending}
            >
              Cancel subscription
            </Button>
          ) : null}
        </div>
      </div>

      {pendingPlan ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary p-4 ring-1 ring-foreground/10">
          <div>
            <p className="text-sm font-medium">
              You picked {pendingPlan.label} when you signed up
            </p>
            <p className="text-xs text-muted-foreground">
              {paidCheckoutAvailable
                ? "Subscribe below to activate it."
                : "It is saved here for when checkout opens."}
            </p>
          </div>
        </div>
      ) : null}

      {current.trialEligible ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-mint/15 p-4 ring-1 ring-foreground/10">
          <div>
            <p className="text-sm font-medium">Try Agency free for 30 days</p>
            <p className="text-xs text-muted-foreground">
              Full agency features, no card required. Reverts to Free when the
              trial ends.
            </p>
          </div>
          <Button size="sm" onClick={beginTrial} disabled={pending}>
            Start 30-day free trial
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = plan.id === current.planId
          return (
            <div
              key={plan.id}
              className={cn(
                "flex flex-col rounded-xl p-4 ring-1",
                isCurrent
                  ? "ring-foreground/40 bg-card"
                  : plan.id === pendingPlan?.id
                    ? "ring-foreground/30 bg-card"
                    : "ring-foreground/10 bg-card",
              )}
            >
              <p className="font-medium">{plan.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{priceLabel(plan)}</p>
              <ul className="mt-3 flex-1 space-y-1 text-xs text-muted-foreground">
                {plan.highlights.map((h) => (
                  <li key={h}>- {h}</li>
                ))}
              </ul>
              <div className="mt-4">
                {isCurrent ? (
                  <Button size="sm" variant="outline" disabled className="w-full">
                    Current plan
                  </Button>
                ) : !plan.billable ? (
                  <Button size="sm" variant="outline" className="w-full" disabled>
                    {plan.monthlyPriceInr === null ? "Contact sales" : "Included"}
                  </Button>
                ) : !paidCheckoutAvailable ? (
                  <Button size="sm" variant="outline" className="w-full" disabled>
                    Coming soon
                  </Button>
                ) : hasActiveSub ? (
                  (plan.monthlyPriceInr ?? 0) < currentPrice ? (
                    /* Downgrade: deliberately low-emphasis, routed through the
                     * retention dialog. */
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full text-xs text-muted-foreground"
                      disabled={pending}
                      onClick={() =>
                        setDowngrade({
                          target: plan,
                          kind: "switch",
                          losses: lossesVs(plan),
                        })
                      }
                    >
                      Downgrade
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={pending}
                      onClick={() => switchPlan(plan)}
                    >
                      {busyPlan === plan.id ? "Working..." : `Upgrade to ${plan.label}`}
                    </Button>
                  )
                ) : (
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={pending}
                    onClick={() => subscribe(plan)}
                  >
                    {busyPlan === plan.id ? "Opening checkout..." : "Subscribe"}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {paidCheckoutAvailable
          ? "Payments are processed by Razorpay. Your plan unlocks once payment is confirmed. Cancelling keeps access until the end of the current billing period."
          : "Paid plans are launching soon. Start a free trial to use Agency features today - no card required."}
      </p>

      <DowngradeDialog
        key={downgrade?.target.id ?? "none"}
        open={downgrade !== null}
        onOpenChange={(open) => !open && setDowngrade(null)}
        currentLabel={currentPlan?.label ?? "your plan"}
        targetLabel={downgrade?.target.label ?? "Free"}
        losses={downgrade?.losses ?? []}
        busy={pending}
        onConfirm={confirmDowngrade}
      />
    </div>
  )
}

function DowngradeDialog({
  open,
  onOpenChange,
  currentLabel,
  targetLabel,
  losses,
  busy,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentLabel: string
  targetLabel: string
  losses: string[]
  busy: boolean
  onConfirm: (reason: string, note: string) => void
}) {
  const [reason, setReason] = useState<string | null>(null)
  const [note, setNote] = useState("")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Before you go - why downgrade?</DialogTitle>
          <DialogDescription>
            Help us understand. Your answer takes a second and keeps Timbl
            getting better.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {DOWNGRADE_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                reason === r
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:bg-muted",
              )}
            >
              {r}
            </button>
          ))}
        </div>

        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything else? (optional)"
          rows={2}
          className="text-sm"
          aria-label="Downgrade note"
        />

        {losses.length > 0 ? (
          <div className="rounded-lg bg-coral/10 p-3 text-xs">
            <p className="mb-1 font-medium text-foreground">
              Downgrading drops these from {currentLabel}:
            </p>
            <ul className="space-y-0.5 text-muted-foreground">
              {losses.map((l) => (
                <li key={l}>- {l}</li>
              ))}
            </ul>
            <p className="mt-2 text-muted-foreground">
              Access continues until the end of your current billing period.
            </p>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:flex-col-reverse sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            disabled={busy || !reason}
            onClick={() => reason && onConfirm(reason, note)}
          >
            {busy ? "Working..." : `Downgrade to ${targetLabel} anyway`}
          </Button>
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Keep {currentLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
