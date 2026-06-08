import { z } from "zod"

/*
 * Per-tenant billing profile - company-use payment details maintained from
 * the control centre. Manual today; carries Razorpay identifiers so the
 * Phase H integration can backfill (razorpayCustomerId, subscription id +
 * status) without a reshape.
 *
 * Stored at organizations/{orgId}/billing/profile. Platform-admin only -
 * tenant clients are denied in firestore.rules (the app reads via Admin SDK).
 */

export const billingStatus = z.enum([
  "trialing",
  "active",
  "past_due",
  "canceled",
  "manual",
])
export type BillingStatus = z.infer<typeof billingStatus>

export const billingProfileSchema = z.object({
  companyName: z.string().max(200).optional(),
  billingEmail: z.union([z.string().email(), z.literal("")]).optional(),
  taxId: z.string().max(60).optional(),
  country: z.string().max(60).optional(),
  currency: z.string().max(8).default("INR"),
  status: billingStatus.default("manual"),
  /* Free-text for manual records, e.g. "Bank transfer" or "UPI". */
  paymentMethod: z.string().max(120).optional(),
  /* Razorpay identifiers - populated by the Phase H subscription flow.
   * razorpaySubscriptionStatus mirrors Razorpay's own state machine
   * (created/authenticated/active/pending/halted/cancelled/completed/expired);
   * `status` above is the normalised app-side billing status. */
  razorpayCustomerId: z.string().max(120).optional(),
  razorpaySubscriptionId: z.string().max(120).optional(),
  razorpayPlanId: z.string().max(120).optional(),
  razorpaySubscriptionStatus: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
  updatedAt: z.string().optional(),
})
export type BillingProfile = z.infer<typeof billingProfileSchema>

export const DEFAULT_BILLING_PROFILE: BillingProfile = {
  currency: "INR",
  status: "manual",
}
