import type { Metadata } from "next"

import { LegalSection, LegalShell } from "@/components/legal/legal-shell"
import { LEGAL } from "@/lib/constants/legal"

export const metadata: Metadata = {
  title: "Terms and conditions",
  description: `The terms that govern your use of ${LEGAL.brand}.`,
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
}

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms and conditions"
      effective={LEGAL.effectiveDate}
      updated={LEGAL.lastUpdated}
      intro={`These terms are an agreement between you and ${LEGAL.legalEntity}, which operates ${LEGAL.brand} ("${LEGAL.brand}", "we", "us"). By creating an account or using ${LEGAL.brand}, you agree to these terms and to our Privacy policy. If you do not agree, do not use the service.`}
    >
      <LegalSection id="acceptance" heading="1. Acceptance and eligibility">
        <p>
          You must be at least 18 years old and able to enter into a binding contract. If you use{" "}
          {LEGAL.brand} on behalf of an organisation, you confirm you are authorised to bind that
          organisation, and &quot;you&quot; means both you and that organisation.
        </p>
      </LegalSection>

      <LegalSection id="service" heading="2. The service">
        <p>
          {LEGAL.brand} is a tool for planning, drafting, scheduling, approving, and publishing
          social media content across connected platforms, including AI-assisted features. The
          service is in early access and features may change. Free access is by invite; paid plans
          can be bought directly from our pricing page.
        </p>
      </LegalSection>

      <LegalSection id="accounts" heading="3. Accounts and access">
        <p>
          You are responsible for your account, for keeping your credentials secure, and for all
          activity under your account. Tell us promptly at{" "}
          <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> if you suspect
          unauthorised use. We may decline or revoke free early access at our discretion. Each paid
          purchase creates a new workspace, and the account that bought it becomes its first
          administrator.
        </p>
      </LegalSection>

      <LegalSection id="acceptable-use" heading="4. Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>break the law or infringe anyone&apos;s rights, including intellectual property and privacy;</li>
          <li>post content that is unlawful, defamatory, hateful, deceptive, or harmful;</li>
          <li>violate the terms or policies of any connected social platform;</li>
          <li>send spam, malware, or attempt to disrupt, probe, or reverse-engineer the service;</li>
          <li>access the service through unauthorised means or resell it without our consent;</li>
          <li>misuse AI features to generate prohibited, infringing, or misleading content.</li>
        </ul>
      </LegalSection>

      <LegalSection id="your-content" heading="5. Your content">
        <p>
          You retain all rights to the content you create or upload. You grant us a limited,
          worldwide, non-exclusive licence to host, process, transmit, and display that content only
          as needed to operate the service for you - including sending it to AI providers and the
          social platforms you connect, at your direction. You are responsible for your content and
          for having the rights to use and publish it.
        </p>
      </LegalSection>

      <LegalSection id="connected-platforms" heading="6. Connected social platforms">
        <p>
          When you connect a third-party platform, you also agree to that platform&apos;s terms, and your
          use of it is governed by them. We act only on your instructions to publish and manage
          content. We are not responsible for the availability, policies, or actions of third-party
          platforms, and they may change or restrict their APIs at any time.
        </p>
      </LegalSection>

      <LegalSection id="ai-output" heading="7. AI-assisted content">
        <p>
          AI features produce suggestions that may be inaccurate or unsuitable. You are responsible
          for reviewing and approving everything before it is published - no content is published
          without your action - and for ensuring published content is lawful and accurate. {LEGAL.brand}{" "}
          is not liable for content you choose to publish.
        </p>
      </LegalSection>

      <LegalSection id="our-ip" heading="8. Our intellectual property">
        <p>
          The {LEGAL.brand} service, software, branding, and content (excluding your content) are
          owned by {LEGAL.legalEntity} and protected by law. We grant you a limited, revocable,
          non-transferable right to use the service under these terms. You may link to {LEGAL.brand}{" "}
          from your own site provided you do not imply endorsement or present our content
          misleadingly.
        </p>
      </LegalSection>

      <LegalSection id="fees" heading="9. Plans, billing and cancellation">
        <h3>Subscriptions</h3>
        <p>
          Paid plans are monthly subscriptions, billed in advance in Indian rupees through our
          payment processor, Razorpay. The price and what each plan includes are shown on our pricing
          page and at checkout. Any applicable taxes are charged as shown at checkout or on your
          invoice. A paid plan unlocks only once Razorpay confirms your payment.
        </p>
        <h3>Renewal</h3>
        <p>
          Your subscription renews automatically each month and is charged to the payment method you
          authorised, until you cancel. Razorpay sends a receipt for every successful charge.
        </p>
        <h3>Failed payments</h3>
        <p>
          If a renewal fails, Razorpay retries the charge and your workspace is marked as past due.
          You keep your plan while we retry. If payment cannot be collected, the subscription ends and
          the workspace moves to the Free plan. Your content is kept, subject to the Free plan&apos;s
          limits.
        </p>
        <h3>Changing or cancelling</h3>
        <p>
          You can change plans or cancel at any time from Plan and billing in your workspace.
          Cancellation takes effect at the end of the billing period you have paid for; you keep your
          plan until then and are not charged again. Refunds are covered by our{" "}
          <a href="/refunds">Cancellation and refund policy</a>.
        </p>
        <h3>Free plan and trial</h3>
        <p>
          The Free plan costs nothing. A Free workspace may start one 30-day Agency trial with no
          payment details. When the trial ends, the workspace returns to the Free plan automatically
          and nothing is charged.
        </p>
        <h3>Price changes</h3>
        <p>
          We may change prices with at least 30 days&apos; notice by email. A new price applies from your
          next billing period after the notice ends, and you can cancel before then.
        </p>
      </LegalSection>

      <LegalSection id="beta-warranty" heading={`10. Beta and "as is" service`}>
        <p>
          The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis, without warranties of any
          kind, express or implied, to the maximum extent permitted by law. Beta features may be
          incomplete, change, or be withdrawn. We do not warrant that the service will be
          uninterrupted, error-free, or secure. Early-access features may change or be withdrawn;
          where we withdraw a feature that is central to a paid plan, you may cancel and request a
          refund for the unused part of the current period.
        </p>
      </LegalSection>

      <LegalSection id="liability" heading="11. Limitation of liability">
        <p>
          To the maximum extent permitted by law, {LEGAL.legalEntity} will not be liable for indirect,
          incidental, special, consequential, or punitive damages, or for lost profits, data, or
          goodwill. Our total liability for any claim relating to the service is limited to the
          greater of the amount you paid us in the 12 months before the claim, or INR 5,000. Nothing
          here excludes liability that cannot be excluded by law.
        </p>
      </LegalSection>

      <LegalSection id="indemnity" heading="12. Indemnity">
        <p>
          You agree to indemnify and hold {LEGAL.legalEntity} harmless from claims, losses, and
          expenses arising from your content, your use of the service, or your breach of these terms
          or of any third-party platform&apos;s terms.
        </p>
      </LegalSection>

      <LegalSection id="suspension" heading="13. Suspension and termination">
        <p>
          You may stop using the service at any time, and ask us to close your workspace by emailing{" "}
          <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>. We may suspend or
          terminate access if you breach these terms, to protect the service or other users, or as
          required by law. A closed or suspended workspace and its content are permanently deleted
          60 days later, unless the law requires us to keep some records for longer. On termination,
          your right to use the service ends; provisions that by their nature should survive will
          survive.
        </p>
      </LegalSection>

      <LegalSection id="changes" heading="14. Changes to these terms">
        <p>
          We may update these terms as the service evolves. We will post the updated version with a
          new &quot;last updated&quot; date, and for material changes we will give reasonable notice. Continued
          use after changes take effect means you accept them.
        </p>
      </LegalSection>

      <LegalSection id="governing-law" heading="15. Governing law and disputes">
        <p>
          These terms are governed by the laws of {LEGAL.governingLawCountry}, without regard to
          conflict-of-law rules. The courts at {LEGAL.jurisdictionCity} have exclusive jurisdiction,
          subject to any mandatory consumer-protection rights you have in your country of residence.
        </p>
      </LegalSection>

      <LegalSection id="grievance" heading="16. Grievance and contact">
        <p>
          For any complaint or notice, including grievances under India&apos;s Information Technology
          rules, contact our {LEGAL.grievanceOfficer} at{" "}
          <a href={`mailto:${LEGAL.grievanceEmail}`}>{LEGAL.grievanceEmail}</a>. We aim to acknowledge
          grievances promptly and resolve them within the timelines the law requires.
        </p>
      </LegalSection>
    </LegalShell>
  )
}
