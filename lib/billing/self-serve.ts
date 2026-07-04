import "server-only"

export function billingSelfServeEnabled(): boolean {
  return process.env.BILLING_SELF_SERVE_ENABLED === "1"
}

/* Governs whether the public /pricing page may start checkout pre-auth.
 * Independent of BILLING_SELF_SERVE_ENABLED: in-app upgrades can be live
 * while the marketing page stays invite-gated. */
export function pricingSelfServeEnabled(): boolean {
  return process.env.PRICING_SELF_SERVE_ENABLED === "1"
}
