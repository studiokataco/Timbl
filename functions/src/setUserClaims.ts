import { beforeUserSignedIn as v2BeforeUserSignedIn, HttpsError } from "firebase-functions/v2/identity"
import { getFirestore, FieldValue } from "firebase-admin/firestore"
import { logger } from "firebase-functions"

/*
 * Multi-tenant blocking trigger. Runs on every sign-in attempt and emits
 * custom claims - `organizationId`, `role`, `userId` - that Firestore Rules
 * read on every request.
 *
 * Resolution order:
 *
 *   1. EXISTING MEMBERSHIP - if the user's email already appears in any
 *      /organizations/{orgId}/users/* row, sign them in to that org. Back-
 *      compat for SAFE/Kataco staff already provisioned in safe-foundation.
 *
 *   2. LEGACY DOMAIN MAP - if email domain is in LEGACY_DOMAIN_TO_ORG, route
 *      to that org and auto-provision a contributor row. This keeps the
 *      pre-multi-tenant behavior for the original allowlist.
 *
 *   3. NEW DOMAIN → NEW ORG - for any other domain, create a brand-new org
 *      keyed by the domain slug (e.g. `acme.com` → `acme-com`), bootstrap
 *      its agentConfig catalog and kanban columns, and mark the signing-in
 *      user as the org's admin.
 *
 * The bootstrap step is inlined here (not imported from lib/org/bootstrap.ts)
 * because the functions/ package has its own tsconfig and can't reach
 * @/lib/*. AGENT_DEFAULTS is duplicated as a typed constant; the canonical
 * source still lives in lib/agents/defaults.ts. If the two drift, manual
 * `installDefaultAgents` can repair an org.
 *
 * Production note: SAFE Foundation prod deploy can pin this behind a
 * feature flag if open-signup needs to wait - set ENV.NEW_ORG_SIGNUP=off
 * in App Hosting secrets to fall back to the legacy "deny non-allowlisted"
 * behavior.
 */

const LEGACY_DOMAIN_TO_ORG: Record<
  string,
  { orgId: string; role: "admin" | "editor" | "contributor" }
> = {
  "safefoundation.org.uk": { orgId: "safe-foundation", role: "contributor" },
  /* Kataco is the platform team - every kataco.in signup gets admin on
   * safe-foundation so they can manage OAuth credentials, agents, etc.
   * without a separate role-grant step. */
  "kataco.in": { orgId: "safe-foundation", role: "admin" },
}

const DEFAULT_PLAN_FOR_NEW_ORG = "agency_v1"

const DEFAULT_KANBAN_COLUMNS = [
  { id: "idea", label: "Idea", color: "#94a3b8" },
  { id: "brief", label: "Brief", color: "#fbbf24" },
  { id: "researching", label: "Researching", color: "#fb923c" },
  { id: "designing", label: "Designing", color: "#ec4899" },
  { id: "review", label: "Review", color: "#8b5cf6" },
  { id: "scheduled", label: "Scheduled", color: "#3b82f6" },
  { id: "posted", label: "Posted", color: "#10b981" },
  { id: "missed", label: "Missed", color: "#ef4444" },
  { id: "archived", label: "Archived", color: "#64748b" },
]

/* Minimal agent seeds - names match AGENT_DEFAULTS in lib/agents/defaults.ts.
 * Only the fields needed to make the row queryable by /settings/agents are
 * populated; the full systemPrompt / budgets / tools come from a follow-up
 * `installDefaultAgents` call which the app triggers on first wizard open
 * if any field is missing. Splitting it this way keeps the blocking trigger
 * fast (under the 7s timeout). */
const AGENT_STUBS: { name: string; role: "config" | "workflow" }[] = [
  { name: "hello", role: "config" },
  { name: "brand-wizard", role: "config" },
  { name: "settings-assistant", role: "config" },
  { name: "meta-config", role: "config" },
  { name: "drafter", role: "workflow" },
  { name: "reviewer", role: "workflow" },
  { name: "scheduler", role: "workflow" },
  { name: "human-gate", role: "workflow" },
  { name: "ideator", role: "workflow" },
  { name: "pipeline", role: "workflow" },
  { name: "cadence-planner", role: "workflow" },
  { name: "approval-triage", role: "workflow" },
  { name: "awareness-researcher", role: "workflow" },
]

export const beforeUserSignedIn = v2BeforeUserSignedIn(async (event) => {
  const user = event.data
  if (!user?.email) throw new HttpsError("permission-denied", "Email required")

  const email = user.email.toLowerCase()
  const domain = email.split("@")[1]
  if (!domain) throw new HttpsError("invalid-argument", "Email missing domain")

  const db = getFirestore()

  /* Platform allowlist - re-stamped on every sign-in so a token refresh
   * never silently drops control-centre access. Source of truth is
   * platform/state/admins/{emailSlug}. Spread into whatever org claims the
   * resolution below produces. Mirrors lib/platform/schema.ts (functions/
   * can't import @/lib). */
  const platformClaim = await resolvePlatformClaim(db, email)

  /* 1. Existing membership - fastest path, no provisioning. */
  const membership = await findMembership(db, email)
  if (membership) {
    logger.info("[claims] resolved membership", { email, ...membership })
    return {
      customClaims: {
        organizationId: membership.orgId,
        role: membership.role,
        userId: membership.userId,
        ...platformClaim,
      },
    }
  }

  /* 2. Legacy domain map - back-compat for SAFE/Kataco. */
  const legacy = LEGACY_DOMAIN_TO_ORG[domain]
  if (legacy) {
    const seed = await provisionContributor(
      db,
      legacy.orgId,
      email,
      user.displayName ?? email.split("@")[0],
      legacy.role,
    )
    logger.info("[claims] provisioned legacy member", {
      email,
      orgId: legacy.orgId,
      role: legacy.role,
      userId: seed.userId,
    })
    return {
      customClaims: {
        organizationId: legacy.orgId,
        role: seed.role,
        userId: seed.userId,
        ...platformClaim,
      },
    }
  }

  /* Consumer mail (gmail.com, etc.) - do not map one domain → one org.
   * Workspace creation runs in the app after sign up (unique org per
   * business). Keep in sync with lib/auth/domains.ts CONSUMER_EMAIL_DOMAINS. */
  if (isConsumerEmailDomain(domain)) {
    logger.info("[claims] consumer email - workspace deferred to app", { email })
    return { customClaims: { ...platformClaim } }
  }

  /* 3. Business domain → shared org. Bootstrap inline (functions/ can't
   * import @/lib/*). A second user from the same domain joins the existing
   * org rather than creating a duplicate. */
  if (process.env.NEW_ORG_SIGNUP === "off") {
    logger.warn("[claims] new-org signup disabled, denying", { email })
    throw new HttpsError(
      "permission-denied",
      "Open signup is currently disabled. Contact your admin for an invite.",
    )
  }

  const orgId = domainToOrgId(domain)
  await ensureOrgBootstrap(db, orgId, deriveOrgName(domain))

  const seed = await provisionContributor(
    db,
    orgId,
    email,
    user.displayName ?? email.split("@")[0],
    "admin", // First user on a new org is its admin.
  )
  logger.info("[claims] provisioned new org + admin", {
    email,
    orgId,
    userId: seed.userId,
  })
  return {
    customClaims: {
      organizationId: orgId,
      role: seed.role,
      userId: seed.userId,
      ...platformClaim,
    },
  }
})

/* platform/state/admins/{emailSlug} exists -> platform claim + role.
 * emailSlug must match lib/platform/schema.ts emailSlug(); role mirrors the
 * doc's `role` field (missing = owner, for back-compat). */
async function resolvePlatformClaim(
  db: FirebaseFirestore.Firestore,
  email: string,
): Promise<{ platform?: "admin"; platformRole?: "owner" | "analyst" }> {
  try {
    const slug = email
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
    const snap = await db.doc(`platform/state/admins/${slug}`).get()
    if (!snap.exists) return {}
    const role = snap.data()?.role === "analyst" ? "analyst" : "owner"
    return { platform: "admin", platformRole: role }
  } catch {
    return {}
  }
}

async function findMembership(
  db: FirebaseFirestore.Firestore,
  email: string,
): Promise<{ orgId: string; userId: string; role: string } | null> {
  const orgs = await db.collection("organizations").get()
  for (const org of orgs.docs) {
    const hit = await db
      .collection(`organizations/${org.id}/users`)
      .where("email", "==", email)
      .limit(1)
      .get()
    if (!hit.empty) {
      const doc = hit.docs[0]
      const data = doc.data()
      return {
        orgId: org.id,
        userId: doc.id,
        role: (data.role as string) ?? "contributor",
      }
    }
  }
  return null
}

async function provisionContributor(
  db: FirebaseFirestore.Firestore,
  orgId: string,
  email: string,
  displayName: string,
  role: "admin" | "editor" | "contributor",
): Promise<{ userId: string; role: "admin" | "editor" | "contributor" }> {
  const userId = slugify(email.split("@")[0])
  const ref = db.collection(`organizations/${orgId}/users`).doc(userId)
  await ref.set(
    {
      id: userId,
      email,
      name: displayName,
      role,
      organizationId: orgId,
      provisionedAt: FieldValue.serverTimestamp(),
      provisionedVia: "beforeUserSignedIn",
    },
    { merge: true },
  )
  return { userId, role }
}

async function ensureOrgBootstrap(
  db: FirebaseFirestore.Firestore,
  orgId: string,
  name: string,
): Promise<void> {
  const orgRef = db.doc(`organizations/${orgId}`)
  const snap = await orgRef.get()
  if (snap.exists) {
    /* Org already exists - a second user from the same domain. Don't
     * re-seed (idempotent), just attach the user via provisionContributor. */
    return
  }

  const now = new Date().toISOString()
  await orgRef.set({
    id: orgId,
    name,
    slug: orgId,
    plan: DEFAULT_PLAN_FOR_NEW_ORG,
    /* No completedAt → first sign-in lands on the onboarding wizard. */
    onboarding: {},
    createdAt: now,
    updatedAt: now,
  })

  /* Stub agentConfigs. The app will hydrate full fields on first wizard
   * open via the in-app installDefaultAgents action - keep this fast. */
  const agentCol = orgRef.collection("agentConfigs")
  for (const stub of AGENT_STUBS) {
    await agentCol.doc(stub.name).set({
      id: stub.name,
      organizationId: orgId,
      name: stub.name,
      role: stub.role,
      enabled: false, // Wizard step 2 turns them on.
      /* needsHydration: true is a tombstone the in-app helper checks to
       * decide whether to overwrite. */
      needsHydration: true,
      createdAt: now,
      updatedAt: now,
    })
  }

  /* Kanban columns - full set, since these are tiny and never change. */
  const colsCol = orgRef.collection("kanbanColumns")
  for (let i = 0; i < DEFAULT_KANBAN_COLUMNS.length; i++) {
    const c = DEFAULT_KANBAN_COLUMNS[i]
    await colsCol.doc(c.id).set({
      id: c.id,
      organizationId: orgId,
      label: c.label,
      color: c.color,
      sortOrder: i,
      isSystemDefault: true,
      createdAt: now,
      updatedAt: now,
    })
  }
}

const CONSUMER_EMAIL_DOMAINS = new Set([
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

function isConsumerEmailDomain(domain: string): boolean {
  return CONSUMER_EMAIL_DOMAINS.has(domain.toLowerCase())
}

function domainToOrgId(domain: string): string {
  return slugify(domain.replace(/\./g, "-"))
}

function deriveOrgName(domain: string): string {
  /* "acme.com" → "Acme" - best effort capitalized first label. The user
   * can rename in /settings/workspace. */
  const first = domain.split(".")[0] ?? domain
  return first.charAt(0).toUpperCase() + first.slice(1)
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60)
}
