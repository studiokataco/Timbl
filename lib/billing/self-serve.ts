import "server-only"

export function billingSelfServeEnabled(): boolean {
  return process.env.BILLING_SELF_SERVE_ENABLED === "1"
}
