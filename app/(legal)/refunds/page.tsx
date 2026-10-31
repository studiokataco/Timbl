import type { Metadata } from "next"

import { LegalSection, LegalShell } from "@/components/legal/legal-shell"
import { LEGAL } from "@/lib/constants/legal"

export const metadata: Metadata = {
  title: "Cancellation and refund policy",
  description: `How cancelling a ${LEGAL.brand} subscription works and when we issue refunds.`,
  alternates: { canonical: "/refunds" },
  robots: { index: true, follow: true },
}

export default function RefundPolicyPage() {
  return (
    <LegalShell
      title="Cancellation and refund policy"
      effective={LEGAL.effectiveDate}
      updated={LEGAL.lastUpdated}
      intro={`This policy explains how to cancel a paid ${LEGAL.brand} plan and when you can get your money back. It forms part of our Terms and conditions.`}
    >
      <LegalSection id="cancelling" heading="1. Cancelling your plan">
        <p>
          You can cancel a paid plan at any time from Plan and billing in your workspace, or by
          emailing <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>. Cancellation
          stops all future charges. You keep your plan until the end of the billing period you have
          already paid for, and then the workspace moves to the Free plan. Your content stays in the
          workspace, subject to the Free plan&apos;s limits.
        </p>
      </LegalSection>

      <LegalSection id="no-partial" heading="2. Partial months">
        <p>
          Plans are billed monthly in advance. We do not refund the unused part of a billing period
          when you cancel or move to a lower plan, because you keep full access until that period
          ends.
        </p>
      </LegalSection>

      <LegalSection id="eligible" heading="3. When we refund in full">
        <p>We refund the full amount of a charge when:</p>
        <ul>
          <li>you were charged twice for the same period, or charged after cancelling;</li>
          <li>a payment was taken but your plan was never activated;</li>
          <li>
            the service was unavailable for most of a billing period because of a fault on our side;
          </li>
          <li>
            we withdraw a feature that is central to your plan, in which case we refund the unused
            part of the current period;
          </li>
          <li>the law requires us to.</li>
        </ul>
        <p>
          Ask within 30 days of the charge. Include the email address on your account and the
          Razorpay payment reference from your receipt.
        </p>
      </LegalSection>

      <LegalSection id="how" heading="4. How refunds are paid">
        <p>
          Approved refunds are issued through Razorpay to the original payment method. We start the
          refund within 2 business days of approving it. Your bank or card issuer usually credits it
          within 5 to 7 business days after that.
        </p>
      </LegalSection>

      <LegalSection id="trial" heading="5. Free plan and trial">
        <p>
          The Free plan and the 30-day Agency trial are free and need no payment details, so there is
          nothing to refund. When a trial ends, the workspace returns to the Free plan and nothing is
          charged.
        </p>
      </LegalSection>

      <LegalSection id="contact" heading="6. Contact">
        <p>
          For any cancellation or refund question, email{" "}
          <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>. We reply within 2
          business days.
        </p>
      </LegalSection>
    </LegalShell>
  )
}
