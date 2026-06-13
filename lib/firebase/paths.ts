/*
 * Path builders for Firestore collections. One source of truth for the
 * /organizations/{orgId}/... layout - every server action and query routes
 * through these helpers, so the multi-tenant scoping is impossible to forget.
 */

export const orgPath = (orgId: string) => `organizations/${orgId}`
export const orgUsersPath = (orgId: string) => `${orgPath(orgId)}/users`
export const orgInvitesPath = (orgId: string) => `${orgPath(orgId)}/invites`
export const orgAccessRequestsPath = (orgId: string) =>
  `${orgPath(orgId)}/accessRequests`
export const orgPostsPath = (orgId: string) => `${orgPath(orgId)}/posts`
export const orgCategoriesPath = (orgId: string) => `${orgPath(orgId)}/categories`
export const orgCtasPath = (orgId: string) => `${orgPath(orgId)}/ctas`
export const orgCampaignsPath = (orgId: string) => `${orgPath(orgId)}/campaigns`
export const orgTemplatesPath = (orgId: string) => `${orgPath(orgId)}/templates`
export const orgEventsPath = (orgId: string) => `${orgPath(orgId)}/events`
export const orgApprovalsLogPath = (orgId: string) => `${orgPath(orgId)}/approvalsLog`
export const orgPostStatusHistoryPath = (orgId: string, postId: string) =>
  `${orgPostsPath(orgId)}/${postId}/statusHistory`
export const orgKanbanColumnsPath = (orgId: string) => `${orgPath(orgId)}/kanbanColumns`

/* Publishing layer - token vault + publish-attempt telemetry. */
export const orgSocialAccountsPath = (orgId: string) => `${orgPath(orgId)}/socialAccounts`
export const orgPublishRunsPath = (orgId: string) => `${orgPath(orgId)}/publishRuns`
/* Per-org OAuth app credentials, encrypted with SOCIAL_TOKEN_KEY. doc id = channel. */
export const orgOauthAppsPath = (orgId: string) => `${orgPath(orgId)}/oauthApps`

export const awarenessDaysPath = "awarenessDays"

/* Agent runtime collections - see lib/agents/** and plan §2. */
export const orgBrandConfigPath = (orgId: string) => `${orgPath(orgId)}/brandConfig`
export const orgBrandConfigDocPath = (orgId: string) =>
  `${orgBrandConfigPath(orgId)}/default`
export const orgAgentConfigsPath = (orgId: string) =>
  `${orgPath(orgId)}/agentConfigs`
export const orgAgentSessionsPath = (orgId: string) =>
  `${orgPath(orgId)}/agentSessions`
export const orgAgentSessionEventsPath = (orgId: string, sessionId: string) =>
  `${orgAgentSessionsPath(orgId)}/${sessionId}/events`
export const orgAgentRunsPath = (orgId: string) =>
  `${orgPath(orgId)}/agentRuns`
export const orgIdeationFeedPath = (orgId: string) =>
  `${orgPath(orgId)}/ideationFeed`
export const orgAwarenessProposalsPath = (orgId: string) =>
  `${orgPath(orgId)}/awarenessDayProposals`

/* Notify-only model-update notifications (§6.8 of the pluggable-providers
 * phase). One doc per flagged provider model. */
export const orgModelUpdatesPath = (orgId: string) =>
  `${orgPath(orgId)}/modelUpdates`

/* Memory + RAG layer - see lib/embeddings/**. */
export const orgAgentMemoryPath = (orgId: string) =>
  `${orgPath(orgId)}/agentMemory`

/* Usage counters keyed by YYYY-MM. Phase B reads these for quota gates;
 * Phase C writes them via the agent-event emitter. */
export const orgUsagePath = (orgId: string) => `${orgPath(orgId)}/usage`
export const orgUsageDocPath = (orgId: string, period: string) =>
  `${orgUsagePath(orgId)}/${period}`

/* Append-only audit log - category create/delete, plan change, member
 * add, template create, etc. Distinct from approvalsLog (which records
 * agent-suggestion approvals only). */
export const orgAuditLogPath = (orgId: string) => `${orgPath(orgId)}/auditLog`

/* Public API surface (Phase 8). */
export const orgPublicAppsPath = (orgId: string) => `${orgPath(orgId)}/publicApps`
export const orgPublicApiAuditPath = (orgId: string) => `${orgPath(orgId)}/publicApiAudit`
export const orgWebhookSubscriptionsPath = (orgId: string) => `${orgPath(orgId)}/webhookSubscriptions`

/* OAuth 2.1 token store (Phase 8). */
export const orgOauthAuthCodesPath = (orgId: string) => `${orgPath(orgId)}/oauthAuthCodes`
export const orgOauthAccessTokensPath = (orgId: string) => `${orgPath(orgId)}/oauthAccessTokens`
export const orgOauthRefreshTokensPath = (orgId: string) => `${orgPath(orgId)}/oauthRefreshTokens`
export const orgConsentGrantsPath = (orgId: string) => `${orgPath(orgId)}/oauthConsentGrants`
