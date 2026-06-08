import { z } from "zod"

/*
 * Per-tenant billing profile - company-use payment details maintained from
 * the control centre. Manual today; field names mirror Stripe so a Phase H
 * integration can backfill (stripeCustomerId, status) without a reshape.
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
  currency: z.string().max(8).default("USD"),
  status: billingStatus.default("manual"),
  /* Free-text until Stripe lands, e.g. "Bank transfer" or "Visa ****4242". */
  paymentMethod: z.string().max(120).optional(),
  stripeCustomerId: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
  updatedAt: z.string().optional(),
})
export type BillingProfile = z.infer<typeof billingProfileSchema>

export const DEFAULT_BILLING_PROFILE: BillingProfile = {
  currency: "USD",
  status: "manual",
}
