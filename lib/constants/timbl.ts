/** Timbl technical identifiers - single source of truth. */

export const TIMBL_DEMO_ORG_ID = "timbl-demo"
export const DEMO_ADMIN_USER_ID = "admin"

export const TIMBL_AGENT_APP_NAME = "timbl-social-planner"

export const DEV_ORG_COOKIE = "timbl_dev_org"

export const TIMBL_DEV_EMAIL_DOMAIN = "timbl.dev"
export const TIMBL_DEV_ADMIN_EMAIL = `admin@${TIMBL_DEV_EMAIL_DOMAIN}`
export const TIMBL_SYSTEM_EMAIL = `system@${TIMBL_DEV_EMAIL_DOMAIN}`

export const TIMBL_FIREBASE_PROJECT_DEV = "timbl-dev"
export const TIMBL_FIREBASE_PROJECT_PROD = "timbl-prod"
export const TIMBL_FIREBASE_RULES_TEST = "timbl-rules-test"

export const EMULATOR_ADMIN_SUB = "emulator-timbl-admin"

export const AGENT_THREADS_DB_NAME = "timbl-agent-threads"

export const HUMAN_ID_PREFIX = "TIM"

/* Every org has this brand. Legacy single-brand orgs keep it as their only
 * brand; it is also the fallback brandId for docs written before brands were
 * real, so nothing is ever brand-less. */
export const DEFAULT_BRAND_ID = "default"

/* Which brand the current session is acting on. Scoped per session like
 * DEV_ORG_COOKIE; absent or unknown-in-this-org falls back to DEFAULT_BRAND_ID. */
export const BRAND_COOKIE = "timbl_brand"
