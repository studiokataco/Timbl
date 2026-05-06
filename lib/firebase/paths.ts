/*
 * Path builders for Firestore collections. One source of truth for the
 * /organizations/{orgId}/... layout — every server action and query routes
 * through these helpers, so the multi-tenant scoping is impossible to forget.
 */

export const orgPath = (orgId: string) => `organizations/${orgId}`
export const orgUsersPath = (orgId: string) => `${orgPath(orgId)}/users`
export const orgPostsPath = (orgId: string) => `${orgPath(orgId)}/posts`
export const orgCategoriesPath = (orgId: string) => `${orgPath(orgId)}/categories`
export const orgCtasPath = (orgId: string) => `${orgPath(orgId)}/ctas`
export const orgCampaignsPath = (orgId: string) => `${orgPath(orgId)}/campaigns`
export const orgTemplatesPath = (orgId: string) => `${orgPath(orgId)}/templates`
export const orgEventsPath = (orgId: string) => `${orgPath(orgId)}/events`
export const orgPostStatusHistoryPath = (orgId: string, postId: string) =>
  `${orgPostsPath(orgId)}/${postId}/statusHistory`
export const orgKanbanColumnsPath = (orgId: string) => `${orgPath(orgId)}/kanbanColumns`

export const awarenessDaysPath = "awarenessDays"
