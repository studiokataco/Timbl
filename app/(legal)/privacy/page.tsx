import type { Metadata } from "next"

import { LegalSection, LegalShell } from "@/components/legal/legal-shell"
import { LEGAL } from "@/lib/constants/legal"

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How Timbl collects, uses, shares, and protects your personal data, and the rights you have under the GDPR and India's Digital Personal Data Protection Act, 2023.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
}

export default function PrivacyPolicyPage() {
  return (
    <LegalShell
      title="Privacy policy"
      effective={LEGAL.effectiveDate}
      updated={LEGAL.lastUpdated}
      intro={`This policy explains how ${LEGAL.brand}, operated by ${LEGAL.legalEntity} ("${LEGAL.brand}", "we", "us"), collects, uses, shares, and protects your personal data, and the rights you have over it. It is written to meet the EU and UK General Data Protection Regulation (GDPR) and India's Digital Personal Data Protection Act, 2023 (DPDP Act) and the rules made under it.`}
    >
      <LegalSection id="who-we-are" heading="1. Who we are">
        <p>
          {LEGAL.brand} is a social media planning tool that helps teams and agencies draft,
          schedule, and publish content across connected social platforms. For the purpose of the
          GDPR we act as a <strong>data controller</strong> for account and usage data, and as a{" "}
          <strong>data processor</strong> for the content you create and the social accounts you
          connect. For the purpose of the DPDP Act we are a <strong>Data Fiduciary</strong>.
        </p>
        <p>
          Operator: {LEGAL.legalEntity}. Registered location: {LEGAL.registeredAddress}. For any
          privacy question, contact us at{" "}
          <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
        </p>
      </LegalSection>

      <LegalSection id="data-we-collect" heading="2. The personal data we collect">
        <h3>You give us</h3>
        <ul>
          <li>Account data - your name, work email, and (optionally) company or agency name.</li>
          <li>
            Access-request data - the details you submit when you request beta access, including how
            you intend to use {LEGAL.brand}.
          </li>
          <li>
            Content - posts, captions, campaigns, briefs, images, comments, and any other material
            you create or upload.
          </li>
          <li>
            Support and communications - messages you send us and your contact preferences.
          </li>
          <li>Billing data - where a paid plan applies, the details needed to process payment.</li>
        </ul>
        <h3>We collect automatically</h3>
        <ul>
          <li>
            Usage data - actions in the product, pages viewed, feature usage, device and browser
            type, and approximate location derived from your IP address.
          </li>
          <li>
            Cookies and similar technologies - used to keep you signed in, remember preferences, and
            understand product usage. See section 6.
          </li>
        </ul>
        <h3>We receive from connected services</h3>
        <ul>
          <li>
            Social platform data - when you connect an account (for example Instagram, Facebook,
            LinkedIn, or X), we receive access tokens and the profile, page, and publishing data the
            platform exposes, strictly to schedule and publish on your behalf.
          </li>
        </ul>
        <p>
          We do not seek to collect special category or sensitive personal data, and we ask that you
          do not store it in {LEGAL.brand}.
        </p>
      </LegalSection>

      <LegalSection id="how-we-use" heading="3. How and why we use your data">
        <p>We use personal data to:</p>
        <ul>
          <li>create and operate your account and the workspaces you belong to;</li>
          <li>provide the core service - drafting, scheduling, approving, and publishing content;</li>
          <li>
            run AI features that draft and suggest content (see section 4) at your direction;
          </li>
          <li>connect, maintain, and publish to your authorised social accounts;</li>
          <li>provide support, send service and security notices, and respond to your requests;</li>
          <li>monitor, secure, debug, and improve the service;</li>
          <li>process payments and prevent fraud and abuse;</li>
          <li>comply with legal obligations and enforce our terms.</li>
        </ul>
        <h3>Legal bases (GDPR) and grounds (DPDP Act)</h3>
        <ul>
          <li>
            <strong>Contract</strong> - to deliver the service you have signed up for.
          </li>
          <li>
            <strong>Consent</strong> - for connecting social accounts, optional communications, and
            non-essential cookies. Under the DPDP Act, processing is carried out on the basis of your
            free, specific, informed, and unambiguous consent, or for the legitimate uses the Act
            permits. You may withdraw consent at any time (section 8).
          </li>
          <li>
            <strong>Legitimate interests</strong> (GDPR only) - to secure, maintain, and improve the
            service, where not overridden by your rights.
          </li>
          <li>
            <strong>Legal obligation</strong> - where the law requires us to process or retain data.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="ai" heading="4. AI features">
        <p>
          {LEGAL.brand} uses AI agents to draft and suggest content. When you use these features, the
          relevant content and instructions are sent to our AI processing providers solely to
          generate the output you requested. You review and approve every post before it is
          published - nothing is published without a human action. We do not use your content to
          train third-party foundation models, and our AI providers are contractually restricted
          from doing so.
        </p>
      </LegalSection>

      <LegalSection id="sharing" heading="5. Who we share data with">
        <p>
          We do not sell personal data. We share it only with service providers (processors) who
          help us run {LEGAL.brand}, under contracts that require them to protect it and use it only
          on our instructions. These include:
        </p>
        <ul>
          <li>cloud hosting and database (Google Cloud / Firebase);</li>
          <li>AI processing providers, to power drafting and suggestion features;</li>
          <li>product analytics, to understand and improve usage;</li>
          <li>email delivery, for service and account messages;</li>
          <li>payment processing, where a paid plan applies;</li>
          <li>
            the social platforms you connect, to publish and manage content at your direction.
          </li>
        </ul>
        <p>
          We may also disclose data where required by law, to enforce our terms, or in connection
          with a merger, acquisition, or sale of assets - with notice where the law requires it.
        </p>
      </LegalSection>

      <LegalSection id="cookies" heading="6. Cookies and analytics">
        <p>
          We use strictly necessary cookies to sign you in and keep the service working, and
          analytics cookies to measure product usage. You can control non-essential cookies through
          your browser settings; blocking strictly necessary cookies may break core functionality.
        </p>
      </LegalSection>

      <LegalSection id="transfers" heading="7. International data transfers">
        <p>
          {LEGAL.brand} and its providers may process data in countries other than your own,
          including outside the EEA, the UK, and India. Where we transfer personal data across
          borders, we rely on appropriate safeguards such as the European Commission&apos;s Standard
          Contractual Clauses (and the UK Addendum), and we transfer DPDP-covered data only to
          countries not restricted by the Government of India.
        </p>
      </LegalSection>

      <LegalSection id="retention" heading="8. How long we keep data">
        <p>
          We keep personal data only for as long as needed for the purposes above: for the life of
          your account, and for a limited period afterwards to meet legal, tax, security, and
          dispute-resolution needs. When data is no longer needed we delete or anonymise it. You can
          ask us to erase your data at any time (section 9); we action valid erasure requests
          promptly and, under the DPDP Act, within the timelines the law sets.
        </p>
      </LegalSection>

      <LegalSection id="your-rights" heading="9. Your rights">
        <p>
          Subject to the law that applies to you, you have the right to:
        </p>
        <ul>
          <li>access the personal data we hold about you and obtain a summary of how it is used;</li>
          <li>correct inaccurate or incomplete data;</li>
          <li>erase your data (&quot;right to be forgotten&quot;);</li>
          <li>restrict or object to certain processing;</li>
          <li>data portability - receive your data in a portable format (GDPR);</li>
          <li>withdraw consent at any time, without affecting prior lawful processing;</li>
          <li>
            nominate another individual to exercise your rights in the event of death or incapacity
            (DPDP Act);
          </li>
          <li>not be subject to solely automated decisions with legal or similarly significant effect;</li>
          <li>complain to a regulator (section 11).</li>
        </ul>
        <p>
          To exercise any right, email{" "}
          <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>. We may need to verify
          your identity. We respond within the timeframes the applicable law requires and will not
          charge for valid requests except where the law allows.
        </p>
      </LegalSection>

      <LegalSection id="security" heading="10. Security and breaches">
        <p>
          We use reasonable technical and organisational measures - including encryption in transit,
          access controls, and tenant isolation - to protect personal data. No system is perfectly
          secure. If a personal data breach occurs, we will notify the relevant supervisory
          authority and affected individuals where and as required by the GDPR and the DPDP Act,
          including notification to the Data Protection Board of India.
        </p>
      </LegalSection>

      <LegalSection id="children" heading="11. Children">
        <p>
          {LEGAL.brand} is a business tool and is not directed at children. We do not knowingly
          collect data from anyone under 18. If you believe a child has provided us data, contact us
          and we will delete it.
        </p>
      </LegalSection>

      <LegalSection id="grievance" heading="12. Grievance redressal and complaints">
        <p>
          If you have a concern about how we handle your personal data, contact our {LEGAL.grievanceOfficer}{" "}
          at <a href={`mailto:${LEGAL.grievanceEmail}`}>{LEGAL.grievanceEmail}</a>. We will
          acknowledge and address grievances within the timelines required under the DPDP Act and the
          Information Technology rules.
        </p>
        <p>
          If you are not satisfied, you may also complain to the Data Protection Board of India, or -
          if you are in the EEA or UK - to your local data protection authority.
        </p>
      </LegalSection>

      <LegalSection id="changes" heading="13. Changes to this policy">
        <p>
          We may update this policy as the service and the law evolve. We will post the new version
          here and update the &quot;last updated&quot; date, and for material changes we will give you notice
          and, where required, seek fresh consent.
        </p>
      </LegalSection>

      <LegalSection id="contact" heading="14. Contact us">
        <p>
          Questions about this policy or your data? Email{" "}
          <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
        </p>
      </LegalSection>
    </LegalShell>
  )
}
