"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  cancelSubscription,
  changePlan,
  createSubscription,
  type SubscriptionStatus,
} from "@/lib/actions/billing"

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
}: {
  current: SubscriptionStatus
  plans: BillingPlanCard[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [busyPlan, setBusyPlan] = useState<string | null>(null)
  const hasActiveSub = Boolean(current.razorpaySubscriptionId) && current.status === "active"

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

  const cancel = () => {
    start(async () => {
      const res = await cancelSubscription()
      if (res.ok) {
        toast.success("Subscription cancelled", {
          description: "Access continues until the end of the billing period.",
        })
        setTimeout(() => router.refresh(), 2500)
      } else {
        toast.error("Could not cancel", { description: res.error })
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
            <Button variant="outline" size="sm" onClick={cancel} disabled={pending}>
              Cancel subscription
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === current.planId
          return (
            <div
              key={plan.id}
              className={cn(
                "flex flex-col rounded-xl p-4 ring-1",
                isCurrent ? "ring-foreground/40 bg-card" : "ring-foreground/10 bg-card",
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
                ) : hasActiveSub ? (
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={pending}
                    onClick={() => switchPlan(plan)}
                  >
                    {busyPlan === plan.id ? "Working..." : "Switch to this plan"}
                  </Button>
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
        Payments are processed by Razorpay. Your plan unlocks once payment is
        confirmed. Cancelling keeps access until the end of the current billing
        period.
      </p>
    </div>
  )
}
