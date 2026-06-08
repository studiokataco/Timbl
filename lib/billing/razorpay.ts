import "server-only"

import Razorpay from "razorpay"

import { PLANS } from "@/lib/plans/plans"

/*
 * Razorpay client + config. Server-only - keys never reach the client. The
 * checkout key_id is exposed to the browser separately (it's publishable) via
 * a server action, not from here.
 *
 * Razorpay subscription model: one Plan per paid tier (created once via
 * scripts/seed-razorpay-plans.ts), then one Subscription per org. Plan ids are
 * env-mapped so the same code points at test or live Razorpay without edits.
 */

let client: Razorpay | null = null

export function getRazorpay(): Razorpay {
  if (client) return client
  const key_id = process.env.RAZORPAY_KEY_ID
  const key_secret = process.env.RAZORPAY_KEY_SECRET
  if (!key_id || !key_secret) {
    throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set")
  }
  client = new Razorpay({ key_id, key_secret })
  return client
}

export function razorpayKeyId(): string {
  const key_id = process.env.RAZORPAY_KEY_ID
  if (!key_id) throw new Error("RAZORPAY_KEY_ID is not set")
  return key_id
}

/* Razorpay amounts are in the smallest unit (paise for INR). Plan prices in
 * lib/plans/plans.ts are whole rupees. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

/* plan id (studio_v1, agency_v1) -> Razorpay plan id, from env. Free has no
 * Razorpay plan (no charge); Scale is custom/manual (no self-serve plan). */
const RAZORPAY_PLAN_ENV: Record<string, string | undefined> = {
  studio_v1: process.env.RAZORPAY_PLAN_STUDIO_V1,
  agency_v1: process.env.RAZORPAY_PLAN_AGENCY_V1,
}

export function razorpayPlanIdFor(planId: string): string | null {
  return RAZORPAY_PLAN_ENV[planId] ?? null
}

/* The plan ids that are billable through Razorpay self-serve checkout. */
export function isBillablePlan(planId: string): boolean {
  const plan = PLANS[planId]
  return Boolean(plan && plan.monthlyPriceInr && plan.monthlyPriceInr > 0)
}
