/**
 * Legal entity + policy facts - single source of truth for the Privacy Policy,
 * Terms & Conditions, and the signup acceptance record.
 *
 * Confirm the entity name, registered office, governing jurisdiction, and
 * grievance officer with counsel before relying on these in production.
 */

export const LEGAL = {
  brand: "Timbl",
  legalEntity: "KataCo",
  contactEmail: "hello@kataco.in",
  grievanceEmail: "hello@kataco.in",
  grievanceOfficer: "Grievance officer",
  registeredAddress: "India",
  governingLawCountry: "India",
  jurisdictionCity: "Bengaluru, India",
  effectiveDate: "26 June 2026",
  lastUpdated: "26 June 2026",
  /** Bumped whenever Terms or Privacy materially change. Recorded with each acceptance. */
  policyVersion: "2026-06-26",
} as const
