import type { DevUser } from "@/lib/auth/dev-session"

/*
 * Cron-triggered agent runs do not have a user request to inherit identity
 * from. They run under SYSTEM_USER so the audit trail in agentRuns clearly
 * distinguishes scheduled from human-initiated work.
 *
 * Phase 7 maps this to a real service account user when auth lands.
 */
export const SYSTEM_USER: DevUser = {
  id: "system",
  email: "system@safefoundation.dev",
  name: "Timbl Cron",
  role: "admin",
}
