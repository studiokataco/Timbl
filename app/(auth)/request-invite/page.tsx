import type { Metadata } from "next"

import { RequestInviteForm } from "@/components/auth/request-invite-form"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Request early access",
  description: "Timbl is in closed beta. Request an invite to get started.",
  robots: { index: true, follow: true },
}

export default function RequestInvitePage() {
  return <RequestInviteForm />
}
