"use client"

import { useState, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { format, isValid } from "date-fns"
import { Check } from "lucide-react"
import { toast } from "sonner"

import { ChoiceChips } from "@/components/shared/choice-chips"
import { FormGroupTitle, FormRow } from "@/components/shared/form-row"
import { StatusDot } from "@/components/shared/status-dot"
import { Section } from "@/components/studio/section"
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
import { loadCheckout } from "@/lib/billing/razorpay-checkout"

export const COMPARE_PLANS = { key: "settings.billing.plans", anchor: "compare-plans" } as const

const SALES_MAILTO = "mailto:hello@timbl.app?subject=Timbl%20plan%20enquiry"

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
  kind: "switch" | "cancel"
  losses: string[]
}

export type BillingPlanCard = {
  id: string
  label: string
  tier: string
  monthlyPriceInr: number | null
  perBrandPriceInr: number | null
  highlights: string[]
  billable: boolean
}


const rupees = (n: number) => `Rs ${n.toLocaleString("en-IN")}`

function priceSummary(plan: BillingPlanCard): string {
  if (plan.monthlyPriceInr === null) return "Custom pricing"
  if (plan.monthlyPriceInr === 0) return "Free"
  const base = `${rupees(plan.monthlyPriceInr)} a month`
  return plan.perBrandPriceInr ? `${base}, plus ${rupees(plan.perBrandPriceInr)} per extra brand` : base
}

function utcDay(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (!isValid(d)) return null
  return format(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), "d MMM yyyy")
}

type StatusCopy = { label: string; detail: string | null; dot: string; pulse?: boolean }

function statusCopy(current: SubscriptionStatus, onPaidPlan: boolean): StatusCopy {
  switch (current.status) {
    case "trialing": {
      const days = current.trialDaysLeft
      return {
        label: "Free trial",
        detail: days === null ? null : days === 0 ? "Ends today." : `${days} ${days === 1 ? "day" : "days"} left.`,
        dot: "bg-warning",
      }
    }
    case "active":
      return {
        label: "Active",
        detail: current.razorpaySubscriptionId ? "Billed monthly through Razorpay." : null,
        dot: "bg-badge-emerald",
      }
    case "past_due":
      return {
        label: "Payment issue",
        detail: "Your last payment did not go through, so agent runs are paused until it is settled.",
        dot: "bg-destructive",
        pulse: true,
      }
    case "canceled":
      return { label: "Cancelled", detail: "Your subscription has ended.", dot: "bg-muted-foreground/50" }
    default:
      return onPaidPlan
        ? {
            label: "Billed directly",
            detail: "This plan is set up by the Timbl team rather than card checkout.",
            dot: "bg-badge-emerald",
          }
        : { label: "No subscription", detail: null, dot: "bg-muted-foreground/50" }
  }
}

const listFormat = new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" })

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
  const status = statusCopy(current, currentPlan?.monthlyPriceInr !== 0)
  const trialEnds = current.status === "trialing" ? utcDay(current.trialEndsAt) : null

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
        toast.success(kind === "cancel" ? "Subscription cancelled" : "Plan change requested", {
          description: "Access continues until the end of your current billing period.",
        })
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
    setBusyPlan("trial")
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
      setBusyPlan(null)
    })
  }

  const askCancel = () =>
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

  const planAction = (plan: BillingPlanCard): ReactNode => {
    const note = (text: string) => (
      <p className="flex min-h-9 items-center text-[13px] text-muted-foreground">{text}</p>
    )
    if (plan.id === current.planId) return note("You are on this plan")
    if (!plan.billable) {
      if (plan.monthlyPriceInr === null) {
        return (
          <Button variant="outline" size="lg" className="w-full" render={<a href={SALES_MAILTO} />}>
            Talk to us
          </Button>
        )
      }
      return note(hasActiveSub ? "Cancel your subscription to move here" : "No payment needed")
    }
    if (!paidCheckoutAvailable) return note("Coming soon")
    if (hasActiveSub) {
      if ((plan.monthlyPriceInr ?? 0) < currentPrice) {
        return (
          <Button
            variant="ghost"
            size="lg"
            className="w-full text-muted-foreground"
            disabled={pending}
            onClick={() => setDowngrade({ target: plan, kind: "switch", losses: lossesVs(plan) })}
          >
            Downgrade
          </Button>
        )
      }
      return (
        <Button size="lg" className="w-full" disabled={pending} onClick={() => switchPlan(plan)}>
          {busyPlan === plan.id ? "Working..." : `Upgrade to ${plan.label}`}
        </Button>
      )
    }
    return (
      <Button size="lg" className="w-full" disabled={pending} onClick={() => subscribe(plan)}>
        {busyPlan === plan.id ? "Opening checkout..." : `Subscribe to ${plan.label}`}
      </Button>
    )
  }

  const lastOdd = plans.length % 2 === 1

  return (
    <>
      <FormGroupTitle>Plan</FormGroupTitle>
      <div className="mt-2">
        <FormRow title="Current plan" hint="What this workspace is on today.">
          <p className="text-[14px] font-medium text-foreground">{current.planLabel}</p>
          {currentPlan ? (
            <p className="mt-0.5 text-[13px] tabular-nums text-muted-foreground">
              {priceSummary(currentPlan)}
            </p>
          ) : null}
        </FormRow>

        <FormRow title="Status" hint="Updates a moment after a payment or plan change clears.">
          <p className="flex items-center gap-2 text-[14px] font-medium text-foreground">
            <StatusDot className={status.dot} pulse={status.pulse} />
            {status.label}
          </p>
          {status.detail ? (
            <p className="mt-0.5 text-[13px] text-muted-foreground">{status.detail}</p>
          ) : null}
        </FormRow>

        {trialEnds ? (
          <FormRow title="Trial ends" hint="Moves back to Free after this unless you subscribe.">
            <p className="text-[14px] font-medium tabular-nums text-foreground">{trialEnds}</p>
          </FormRow>
        ) : null}

        {pendingPlan ? (
          <FormRow title="Picked at sign-up" hint="The plan you chose before this workspace was approved.">
            <p className="text-[14px] font-medium text-foreground">{pendingPlan.label}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {paidCheckoutAvailable
                ? "Subscribe to activate it."
                : "It is saved here for when checkout opens."}
            </p>
            {paidCheckoutAvailable && pendingPlan.billable ? (
              <Button
                size="lg"
                className="mt-3 px-3.5"
                disabled={pending}
                onClick={() => subscribe(pendingPlan)}
              >
                {busyPlan === pendingPlan.id ? "Opening checkout..." : `Subscribe to ${pendingPlan.label}`}
              </Button>
            ) : null}
          </FormRow>
        ) : null}

        {current.trialEligible ? (
          <FormRow
            title="Free trial"
            hint="30 days of Agency features, no card required. Moves back to Free when it ends."
          >
            <Button size="lg" className="px-3.5" onClick={beginTrial} disabled={pending}>
              {busyPlan === "trial" ? "Starting trial..." : "Start 30-day free trial"}
            </Button>
          </FormRow>
        ) : null}

        {hasActiveSub ? (
          <FormRow
            title="Cancel subscription"
            hint="Access continues until the end of the current billing period, then moves to Free."
          >
            <Button variant="outline" size="lg" className="px-3.5" onClick={askCancel} disabled={pending}>
              Cancel subscription
            </Button>
          </FormRow>
        ) : null}
      </div>

      <div id={COMPARE_PLANS.anchor} className="mt-8 scroll-mt-20">
        <Section
          id={COMPARE_PLANS.key}
          title="Compare plans"
          summary={listFormat.format(plans.map((p) => p.label))}
          defaultOpen={false}
        >
          <div className="@container">
            <ul
              className={cn(
                "grid gap-px overflow-hidden rounded-xl border border-border bg-border @lg:grid-cols-2",
                plans.length === 4 && "@4xl:grid-cols-4",
              )}
            >
              {plans.map((plan, i) => {
                const isCurrent = plan.id === current.planId
                const isPending = plan.id === pendingPlan?.id
                return (
                  <li
                    key={plan.id}
                    className={cn(
                      "flex min-w-0 flex-col bg-background p-4",
                      lastOdd && i === plans.length - 1 && "@lg:col-span-2",
                    )}
                  >
                    <div className="flex min-h-5 items-center justify-between gap-2">
                      <h3 className="truncate text-[14px] font-semibold text-foreground">{plan.label}</h3>
                      {isCurrent || isPending ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground">
                          <StatusDot className={isCurrent ? "bg-badge-emerald" : "bg-warning"} />
                          {isCurrent ? "Current" : "Picked at sign-up"}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-[20px] font-semibold leading-tight tracking-tight tabular-nums text-foreground">
                        {plan.monthlyPriceInr === null
                          ? "Custom"
                          : plan.monthlyPriceInr === 0
                            ? "Free"
                            : rupees(plan.monthlyPriceInr)}
                      </span>
                      {plan.monthlyPriceInr ? (
                        <span className="text-[12px] text-muted-foreground">a month</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 min-h-[18px] text-[12px] tabular-nums text-muted-foreground">
                      {plan.perBrandPriceInr ? `Plus ${rupees(plan.perBrandPriceInr)} per extra brand` : null}
                    </p>
                    <ul className="mt-3 flex-1 space-y-1.5">
                      {plan.highlights.map((h) => (
                        <li key={h} className="flex gap-2 text-[13px] leading-snug text-muted-foreground">
                          <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-foreground/70" />
                          {h}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4">{planAction(plan)}</div>
                  </li>
                )
              })}
            </ul>
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">
            {paidCheckoutAvailable
              ? "Payments are processed by Razorpay. A new plan unlocks once payment is confirmed. Cancelling keeps access until the end of the current billing period."
              : current.trialEligible
                ? "Paid plans are launching soon. Start a free trial to use Agency features today, no card required."
                : "Paid plans are launching soon."}
          </p>
        </Section>
      </div>

      <DowngradeDialog
        key={downgrade?.target.id ?? "none"}
        open={downgrade !== null}
        onOpenChange={(open) => !open && setDowngrade(null)}
        kind={downgrade?.kind ?? "switch"}
        currentLabel={currentPlan?.label ?? "your plan"}
        targetLabel={downgrade?.target.label ?? "Free"}
        losses={downgrade?.losses ?? []}
        busy={pending}
        onConfirm={confirmDowngrade}
      />
    </>
  )
}

function DowngradeDialog({
  open,
  onOpenChange,
  kind,
  currentLabel,
  targetLabel,
  losses,
  busy,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: DowngradeTarget["kind"]
  currentLabel: string
  targetLabel: string
  losses: string[]
  busy: boolean
  onConfirm: (reason: string, note: string) => void
}) {
  const [reason, setReason] = useState<string>("")
  const [note, setNote] = useState("")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{kind === "cancel" ? "Before you cancel, what changed?" : "Before you downgrade, what changed?"}</DialogTitle>
          <DialogDescription>
            One tap tells us what to fix. It keeps Timbl getting better.
          </DialogDescription>
        </DialogHeader>

        <div className="[&_button]:h-9">
          <ChoiceChips
            label="Reason"
            options={DOWNGRADE_REASONS.map((r) => ({ key: r as string, label: r }))}
            value={reason}
            onChange={setReason}
            disabled={busy}
          />
        </div>

        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything else? (optional)"
          rows={2}
          className="text-[13px]"
          aria-label="Anything else"
        />

        {losses.length > 0 ? (
          <div className="rounded-lg bg-secondary p-3 text-[13px]">
            <p className="mb-1 font-medium text-foreground">
              Downgrading drops these from {currentLabel}:
            </p>
            <ul className="space-y-0.5 text-muted-foreground">
              {losses.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Access continues until the end of your current billing period.
            </p>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:flex-col-reverse sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="text-muted-foreground"
            disabled={busy || !reason}
            onClick={() => reason && onConfirm(reason, note)}
          >
            {busy ? "Working..." : `Downgrade to ${targetLabel} anyway`}
          </Button>
          <Button type="button" size="lg" className="w-full" disabled={busy} onClick={() => onOpenChange(false)}>
            Keep {currentLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
