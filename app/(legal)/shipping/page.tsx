import type { Metadata } from "next"

import { LegalSection, LegalShell } from "@/components/legal/legal-shell"
import { LEGAL } from "@/lib/constants/legal"

export const metadata: Metadata = {
  title: "Delivery policy",
  description: `How and when you get access to ${LEGAL.brand} after you buy a plan.`,
  alternates: { canonical: "/shipping" },
  robots: { index: true, follow: true },
}

export default function DeliveryPolicyPage() {
  return (
    <LegalShell
      title="Delivery policy"
      effective={LEGAL.effectiveDate}
      updated={LEGAL.lastUpdated}
      intro={`${LEGAL.brand} is online software. Nothing is shipped physically; you get access through your web browser.`}
    >
      <LegalSection id="delivery" heading="1. How you receive the service">
        <p>
          When you buy a paid plan, your workspace is created and your plan is activated as soon as
          Razorpay confirms your payment, usually within a minute. You are then taken straight into
          your workspace, and we email a confirmation to the address on your account.
        </p>
      </LegalSection>

      <LegalSection id="upgrades" heading="2. Upgrades and renewals">
        <p>
          Upgrades from inside an existing workspace take effect as soon as payment is confirmed.
          Renewals keep your access running without interruption.
        </p>
      </LegalSection>

      <LegalSection id="delays" heading="3. If access is delayed">
        <p>
          If your plan has not activated within 30 minutes of a successful payment, email{" "}
          <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> with your Razorpay
          payment reference. We will activate it or refund you in full under our{" "}
          <a href="/refunds">Cancellation and refund policy</a>.
        </p>
      </LegalSection>
    </LegalShell>
  )
}
