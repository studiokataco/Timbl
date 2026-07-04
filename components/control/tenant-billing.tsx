"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { setBillingProfile } from "@/lib/actions/platform/billing"
import type { BillingProfile, BillingStatus } from "@/lib/schemas/billing"

const STATUSES: BillingStatus[] = ["manual", "trialing", "active", "past_due", "canceled"]

export function TenantBilling({
  orgId,
  profile,
}: {
  orgId: string
  profile: BillingProfile
}) {
  const [pending, start] = useTransition()
  const [form, setForm] = useState<BillingProfile>(profile)

  const set = <K extends keyof BillingProfile>(k: K, v: BillingProfile[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const save = () =>
    start(async () => {
      const res = await setBillingProfile(orgId, form)
      if (res.ok) toast.success("Billing profile saved")
      else toast.error(`Save failed: ${res.error ?? "unknown"}`)
    })

  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/5 px-4 py-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          Billing profile
        </h2>
        <span className="text-xs text-muted-foreground">company-use · manual until Razorpay</span>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <Field label="Company name">
          <Input value={form.companyName ?? ""} onChange={(e) => set("companyName", e.target.value)} />
        </Field>
        <Field label="Billing email">
          <Input type="email" value={form.billingEmail ?? ""} onChange={(e) => set("billingEmail", e.target.value)} />
        </Field>
        <Field label="Tax / VAT ID">
          <Input value={form.taxId ?? ""} onChange={(e) => set("taxId", e.target.value)} />
        </Field>
        <Field label="Country">
          <Input value={form.country ?? ""} onChange={(e) => set("country", e.target.value)} />
        </Field>
        <Field label="Currency">
          <Input value={form.currency ?? "INR"} onChange={(e) => set("currency", e.target.value)} />
        </Field>
        <Field label="Billing status">
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value as BillingStatus)}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Payment method">
          <Input
            placeholder="Bank transfer, UPI..."
            value={form.paymentMethod ?? ""}
            onChange={(e) => set("paymentMethod", e.target.value)}
          />
        </Field>
        <Field label="Razorpay customer ID (Phase H)">
          <Input value={form.razorpayCustomerId ?? ""} onChange={(e) => set("razorpayCustomerId", e.target.value)} />
        </Field>
        <Field label="Razorpay subscription ID (Phase H)">
          <Input value={form.razorpaySubscriptionId ?? ""} onChange={(e) => set("razorpaySubscriptionId", e.target.value)} />
        </Field>
        <Field label="Razorpay subscription status">
          <div className="flex h-9 items-center rounded-md border bg-muted/40 px-2 text-sm text-muted-foreground">
            {profile.razorpaySubscriptionStatus ?? "-"}
          </div>
        </Field>
        <Field label="Razorpay plan ID">
          <div className="flex h-9 items-center rounded-md border bg-muted/40 px-2 text-sm text-muted-foreground">
            {profile.razorpayPlanId ?? "-"}
          </div>
        </Field>
        {profile.razorpaySubscriptionId ? (
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Status and subscription fields are managed by the Razorpay webhook - manual edits can be overwritten.
          </p>
        ) : null}
        <div className="sm:col-span-2">
          <Field label="Notes">
            <Input value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="flex justify-end border-t border-foreground/5 px-4 py-3">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Saving..." : "Save billing profile"}
        </Button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
