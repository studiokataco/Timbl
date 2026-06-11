import { randomBytes } from "crypto"

import { TIMBL_DEMO_ORG_ID } from "@/lib/constants/timbl"

export const LEGACY_DOMAIN_TO_ORG: Record<
  string,
  { orgId: string; role: "admin" | "editor" | "contributor" }
> = {
  "safefoundation.org.uk": { orgId: TIMBL_DEMO_ORG_ID, role: "contributor" },
  "kataco.in": { orgId: TIMBL_DEMO_ORG_ID, role: "admin" },
}

/*
 * Personal / consumer mail hosts - one shared domain must NOT map to one
 * tenant. Each "create workspace" gets a unique org id (see
 * orgIdForNewWorkspace). Keep in sync with functions/src/setUserClaims.ts.
 */
export const CONSUMER_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "msn.com",
  "pm.me",
])

export function isConsumerEmailDomain(domain: string): boolean {
  return CONSUMER_EMAIL_DOMAINS.has(domain.toLowerCase())
}

export function domainToOrgId(domain: string): string {
  return slugify(domain.replace(/\./g, "-"))
}

/** Org id for a brand-new workspace (app "create workspace" + business-domain join). */
export function orgIdForNewWorkspace(email: string): string {
  const norm = email.trim().toLowerCase()
  const [local, domain] = norm.split("@")
  if (!domain) return `ws-${slugify(norm)}`

  if (isConsumerEmailDomain(domain)) {
    const localSlug = slugify(local || "user") || "user"
    const suffix = randomBytes(5).toString("hex")
    return `ws-${localSlug}-${suffix}`.slice(0, 60)
  }

  return domainToOrgId(domain)
}

export function defaultOrgNameForNewWorkspace(
  email: string,
  displayName?: string,
): string {
  const domain = email.split("@")[1]?.toLowerCase()
  if (!domain) return "Your workspace"
  if (isConsumerEmailDomain(domain)) {
    const label = displayName?.trim() || email.split("@")[0] || "Your"
    return `${label} workspace`
  }
  return deriveOrgName(domain)
}

export function deriveOrgName(domain: string): string {
  const first = domain.split(".")[0] ?? domain
  return first.charAt(0).toUpperCase() + first.slice(1)
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60)
}
