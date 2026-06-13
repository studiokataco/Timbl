import "server-only"

import { getAdminDb } from "@/lib/firebase/admin"
import { orgPublicApiAuditPath } from "@/lib/firebase/paths"

export type PublicAuditKind =
  | "posts.create"
  | "posts.update"
  | "posts.delete"
  | "posts.get"
  | "posts.list"
  | "posts.schedule"
  | "posts.unschedule"
  | "posts.publish_now"
  | "posts.edit"
  | "ideation.create"
  | "ideation.list"
  | "ideation.promote"
  | "approvals.request"
  | "approvals.list"
  | "approvals.decide"
  | "categories.list"
  | "channels.list"
  | "channels.get"
  | "metrics.window"
  | "webhooks.subscribe"
  | "webhooks.list"
  | "mcp.tool_call"

export interface PublicAuditInput {
  orgId: string
  kind: PublicAuditKind
  appId: string
  subjectUserId: string | null
  resourceId?: string
  latencyMs: number
  success: boolean
  errorCode?: string
}

export async function writePublicAudit(event: PublicAuditInput): Promise<void> {
  try {
    const db = getAdminDb()
    const ref = db.collection(orgPublicApiAuditPath(event.orgId)).doc()
    await ref.set({
      id: ref.id,
      organizationId: event.orgId,
      kind: event.kind,
      appId: event.appId,
      subjectUserId: event.subjectUserId,
      resourceId: event.resourceId ?? null,
      latencyMs: event.latencyMs,
      success: event.success,
      errorCode: event.errorCode ?? null,
      createdAt: new Date().toISOString(),
    })
  } catch (err) {
    console.warn(
      `[public-audit] write failed kind=${event.kind} orgId=${event.orgId}: ${
        err instanceof Error ? err.message : err
      }`,
    )
  }
}
