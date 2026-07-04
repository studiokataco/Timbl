import type { Metadata } from "next"

import { RequestInviteForm } from "@/components/auth/request-invite-form"
import { PLAN_CHOICES, type PlanChoice } from "@/lib/schemas/signupRequest"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Request early access",
  description: "Timbl is in closed beta. Request an invite to get started.",
  robots: { index: true, follow: true },
}

export default async function RequestInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>
}) {
  const { plan } = await searchParams
  const selected = PLAN_CHOICES.includes(plan as PlanChoice) ? (plan as PlanChoice) : undefined
  return <RequestInviteForm plan={selected} />
}
