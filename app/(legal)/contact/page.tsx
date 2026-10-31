import type { Metadata } from "next"

import { LegalSection, LegalShell } from "@/components/legal/legal-shell"
import { LEGAL } from "@/lib/constants/legal"

export const metadata: Metadata = {
  title: "Contact us",
  description: `How to reach the team behind ${LEGAL.brand}.`,
  alternates: { canonical: "/contact" },
  robots: { index: true, follow: true },
}

export default function ContactPage() {
  return (
    <LegalShell
      title="Contact us"
      effective={LEGAL.effectiveDate}
      updated={LEGAL.lastUpdated}
      intro={`${LEGAL.brand} is built and operated by ${LEGAL.legalEntity}. We reply to every message within 2 business days.`}
    >
      <LegalSection id="email" heading="Email">
        <p>
          Support, billing, sales, and general questions:{" "}
          <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
        </p>
      </LegalSection>

      <LegalSection id="address" heading="Registered office">
        <p>
          {LEGAL.legalEntity}
          <br />
          {LEGAL.registeredAddress}
        </p>
      </LegalSection>

      <LegalSection id="grievance" heading="Grievance officer">
        <p>
          For complaints about the service or about how we handle personal data, contact our{" "}
          {LEGAL.grievanceOfficer} at{" "}
          <a href={`mailto:${LEGAL.grievanceEmail}`}>{LEGAL.grievanceEmail}</a>. We acknowledge
          grievances promptly and resolve them within the timelines Indian law requires.
        </p>
      </LegalSection>
    </LegalShell>
  )
}
