import { z } from "zod"

import { coercePlatformRole, type PlatformRole } from "@/lib/auth/platform-rbac"

/*
 * Platform (super-admin) data layer. Everything the control centre owns
 * lives under the single top-level `platform` collection so one Firestore
 * rule - match /platform/{document=**} - gates the whole tree.
 *
 * Layout (all paths below are absolute Firestore paths):
 *
 *   platform/config                                  singleton settings doc
 *   platform/state/admins/{emailSlug}                allowlist (source of truth)
 *   platform/state/auditLog/{autoId}                 admin forensic trail
 *   platform/state/signals/{autoId}                  tenant-side ops signals
 *   platform/state/impersonationSessions/{id}        active impersonations
 *   platform/state/rollups/{YYYY-MM}                 global usage rollup
 *   platform/state/orgRollups/{orgId}                per-org snapshot (tenant list)
 *   platform/state/orgRollups/{orgId}/periods/{YYYY-MM}   per-org per-month
 *   platform/state/orgRollups/{orgId}/daily/{YYYY-MM-DD}  per-org per-day
 *
 * `platform/state` itself is an implicit parent doc - subcollections exist
 * under it whether or not the doc is materialised.
 *
 * NOTE for functions/: the Cloud Function reconciler cannot import this
 * module (separate tsconfig, no @/lib). It inlines the same path strings -
 * keep them in sync. See functions/src/platformRollup.ts.
 */

/* The sole root platform admin at launch. Every other platform admin is
 * granted from inside the control centre via grantPlatformAdmin. */
export const ROOT_PLATFORM_ADMIN_EMAIL = "hello@kataco.in"

const ROOT = "platform/state"

export const platformConfigDocPath = "platform/config"
export const platformRealtimeHealthPath = "platform/health/realtime"
export const platformRealtimeHealthDocPath = (orgId: string) =>
  `${platformRealtimeHealthPath}/${orgId}`
export const platformAdminsPath = `${ROOT}/admins`
export const platformAdminDocPath = (slug: string) => `${platformAdminsPath}/${slug}`
export const platformAuditLogPath = `${ROOT}/auditLog`
export const platformSignalsPath = `${ROOT}/signals`
export const platformImpersonationPath = `${ROOT}/impersonationSessions`
export const platformImpersonationDocPath = (id: string) =>
  `${platformImpersonationPath}/${id}`
export const platformRollupsPath = `${ROOT}/rollups`
export const platformRollupDocPath = (period: string) =>
  `${platformRollupsPath}/${period}`
export const platformBillingPath = `${ROOT}/billing`
export const platformBillingDocPath = (orgId: string) =>
  `${platformBillingPath}/${orgId}`
/* Razorpay webhook delivery ids, kept for idempotency (process once). */
export const platformWebhookEventsPath = `${ROOT}/webhookEvents`
export const platformWebhookEventDocPath = (eventId: string) =>
  `${platformWebhookEventsPath}/${eventId}`
export const platformSignupRequestsPath = `${ROOT}/signupRequests`
export const platformSignupRequestDocPath = (id: string) =>
  `${platformSignupRequestsPath}/${id}`
export const platformConsentsPath = `${ROOT}/consents`
export const platformConsentDocPath = (email: string) =>
  `${platformConsentsPath}/${emailSlug(email)}`
export const platformOrgRollupsPath = `${ROOT}/orgRollups`
export const platformOrgRollupDocPath = (orgId: string) =>
  `${platformOrgRollupsPath}/${orgId}`
export const platformOrgRollupPeriodsPath = (orgId: string) =>
  `${platformOrgRollupDocPath(orgId)}/periods`
export const platformOrgRollupPeriodDocPath = (orgId: string, period: string) =>
  `${platformOrgRollupPeriodsPath(orgId)}/${period}`
export const platformOrgRollupDailyPath = (orgId: string) =>
  `${platformOrgRollupDocPath(orgId)}/daily`
export const platformOrgRollupDailyDocPath = (orgId: string, date: string) =>
  `${platformOrgRollupDailyPath(orgId)}/${date}`

/* email -> doc id. hello@kataco.in -> hello-kataco-in. */
export function emailSlug(email: string): string {
  return email
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

/* Firestore field names can't contain . ~ * / [ ]. Model ids (e.g.
 * "google/gemini-2.5-flash") and provider ids are used as map keys in
 * rollups, so sanitise them. Display layers show the sanitised key; the
 * real name is preserved separately in the `*Names` maps. */
export function safeFieldKey(raw: string): string {
  return raw.replace(/[.~*/[\]]/g, "_") || "_"
}

export const ROLLUP_ROOT = ROOT

/* ── zod doc shapes ──────────────────────────────────────────────────── */

/* Role -> capability bundles live in lib/auth/platform-rbac.ts (the single
 * source of truth, shared with the client). This enum is just the wire shape. */
export const platformRole = z.enum(["owner", "admin", "support"])
export type { PlatformRole }

/* Stored docs and minted claims may carry a missing role (legacy root grant)
 * or the retired "analyst" value; coerce both to a current role on read so a
 * stale value never drops an admin row from the allowlist. */
export const storedPlatformRole = z.preprocess(coercePlatformRole, platformRole)

export const platformAdminSchema = z.object({
  email: z.string().email(),
  role: storedPlatformRole,
  grantedBy: z.string(),
  grantedAt: z.string(),
})
export type PlatformAdmin = z.infer<typeof platformAdminSchema>

export const platformAuditAction = z.enum([
  "org.suspend",
  "org.reactivate",
  "org.delete",
  "org.auto_delete",
  "org.rename",
  "plan.change",
  "quota.override",
  "agent.force_run",
  "agent.cancel",
  "trial.start",
  "trial.extend",
  "trial.cancel",
  "grandfather.set",
  "feature_flag.set",
  "impersonation.start",
  "impersonation.end",
  "admin.grant",
  "admin.revoke",
  "billing.update",
  "signup.approve",
  "signup.deny",
  "user.claims_remint",
  "user.membership_assign",
  "config.realtime_default",
])
export type PlatformAuditAction = z.infer<typeof platformAuditAction>

export const platformAuditEntrySchema = z.object({
  id: z.string(),
  actorUid: z.string(),
  actorEmail: z.string(),
  action: platformAuditAction,
  targetOrgId: z.string().nullable().optional(),
  target: z
    .object({ type: z.string(), id: z.string(), label: z.string().optional() })
    .nullable()
    .optional(),
  meta: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string(),
})
export type PlatformAuditEntry = z.infer<typeof platformAuditEntrySchema>

export const platformSignalKind = z.enum([
  "signup.requested",
  "agent.failed",
  "quota.breached",
])
export type PlatformSignalKind = z.infer<typeof platformSignalKind>

export const platformSignalSchema = z.object({
  id: z.string(),
  kind: platformSignalKind,
  orgId: z.string().nullable().optional(),
  summary: z.string(),
  meta: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string(),
})
export type PlatformSignal = z.infer<typeof platformSignalSchema>

export const impersonationSessionSchema = z.object({
  id: z.string(),
  adminUid: z.string(),
  adminEmail: z.string(),
  orgId: z.string(),
  userId: z.string(),
  role: z.enum(["admin", "editor", "contributor"]),
  readOnly: z.boolean().default(true),
  expiresAt: z.string(),
  revoked: z.boolean().default(false),
  createdAt: z.string(),
})
export type ImpersonationSession = z.infer<typeof impersonationSessionSchema>

const usdMap = z.record(z.string(), z.number()).default({})
const countMap = z.record(z.string(), z.number()).default({})
const nameMap = z.record(z.string(), z.string()).default({})

export const platformRollupSchema = z.object({
  period: z.string(),
  usdCost: z.number().default(0),
  agentRuns: z.number().default(0),
  promptTokens: z.number().default(0),
  completionTokens: z.number().default(0),
  cachedTokens: z.number().default(0),
  embeddingCalls: z.number().default(0),
  runsByOutcome: countMap,
  byProvider: usdMap,
  byModel: usdMap,
  modelNames: nameMap,
  activeOrgs: z.number().default(0),
  updatedAt: z.string().optional(),
})
export type PlatformRollup = z.infer<typeof platformRollupSchema>

export const orgRollupSnapshotSchema = z.object({
  orgId: z.string(),
  name: z.string().optional(),
  plan: z.string().optional(),
  status: z.enum(["active", "suspended"]).default("active"),
  seats: z.number().default(0),
  mtdUsdCost: z.number().default(0),
  mtdAgentRuns: z.number().default(0),
  failureRate: z.number().default(0),
  onboardingCompletedAt: z.string().nullable().optional(),
  lastRunAt: z.string().nullable().optional(),
  updatedAt: z.string().optional(),
})
export type OrgRollupSnapshot = z.infer<typeof orgRollupSnapshotSchema>

export const signupRequestSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  company: z.string().nullish(),
  useCase: z.string().nullish(),
  status: z.enum(["pending", "approved", "denied"]).default("pending"),
  requestedAt: z.string(),
  decidedAt: z.string().nullish(),
  decidedBy: z.string().nullish(),
  orgId: z.string().nullish(),
  acceptedTerms: z.boolean().nullish(),
  acceptedAt: z.string().nullish(),
  acceptedPolicyVersion: z.string().nullish(),
})
export type SignupRequest = z.infer<typeof signupRequestSchema>

export const consentRecordSchema = z.object({
  email: z.string().email(),
  uid: z.string().nullish(),
  acceptedTerms: z.literal(true),
  acceptedAt: z.string(),
  policyVersion: z.string(),
  context: z.enum(["invite_request", "account_creation"]),
})
export type ConsentRecord = z.infer<typeof consentRecordSchema>

export const orgRollupPeriodSchema = z.object({
  period: z.string(),
  usdCost: z.number().default(0),
  agentRuns: z.number().default(0),
  promptTokens: z.number().default(0),
  completionTokens: z.number().default(0),
  cachedTokens: z.number().default(0),
  runsByOutcome: countMap,
  byProvider: usdMap,
  byModel: usdMap,
  modelNames: nameMap,
  updatedAt: z.string().optional(),
})
export type OrgRollupPeriod = z.infer<typeof orgRollupPeriodSchema>
