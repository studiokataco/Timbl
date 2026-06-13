export const dynamic = "force-dynamic"

import { listPublicApps, revokePublicApp } from "@/lib/actions/public-apps"
import { getAdminDb } from "@/lib/firebase/admin"
import { getCurrentOrgId } from "@/lib/auth/server-helpers"
import { orgPublicApiAuditPath } from "@/lib/firebase/paths"
import { IntegrationsClient } from "./client"

export interface AuditRow {
  id: string
  kind: string
  appId: string
  success: boolean
  latencyMs: number
  errorCode: string | null
  createdAt: string
}

export default async function SettingsIntegrationsPage() {
  const [apps, orgId] = await Promise.all([
    listPublicApps(),
    getCurrentOrgId(),
  ])

  const snap = await getAdminDb()
    .collection(orgPublicApiAuditPath(orgId))
    .orderBy("createdAt", "desc")
    .limit(20)
    .get()

  const auditRows: AuditRow[] = snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      kind: data.kind ?? "",
      appId: data.appId ?? "",
      success: data.success ?? false,
      latencyMs: data.latencyMs ?? 0,
      errorCode: data.errorCode ?? null,
      createdAt: data.createdAt ?? "",
    }
  })

  return (
    <div className="px-4 sm:px-6 py-4 flex-1">
      <div className="mb-4">
        <h1 className="text-lg font-medium">Integrations</h1>
        <p className="text-xs text-muted-foreground">
          API keys for external apps and agents. Keys are scoped per integration.
        </p>
      </div>
      <IntegrationsClient
        apps={apps}
        auditRows={auditRows}
        revokeAction={revokePublicApp}
      />
    </div>
  )
}
