/**
 * Legal entity + policy facts - single source of truth for the Privacy Policy,
 * Terms & Conditions, and the signup acceptance record.
 *
 * Confirm the entity name, registered office, governing jurisdiction, and
 * grievance officer with counsel before relying on these in production.
 */

export const LEGAL = {
  brand: "Timbl",
  legalEntity: "Katana Collective Creative Studio LLP",
  contactEmail: "hello@kataco.in",
  grievanceEmail: "hello@kataco.in",
  grievanceOfficer: "Administrator, Timbl",
  registeredAddress:
    "Flat 8, 1st Floor, Vaman Residency, Cariappa Colony, Nanawadi, Belagavi, Karnataka 590009, India",
  governingLawCountry: "India",
  jurisdictionCity: "Bengaluru, India",
  effectiveDate: "31 October 2026",
  lastUpdated: "31 October 2026",
  /** Bumped whenever Terms or Privacy materially change. Recorded with each acceptance. */
  policyVersion: "2026-10-31",
} as const
