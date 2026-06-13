import { redirect } from "next/navigation"

export interface AuditRow {
  id: string
  kind: string
  appId: string
  success: boolean
  latencyMs: number
  errorCode: string | null
  createdAt: string
}

export default function SettingsIntegrationsPage() {
  redirect("/settings/channels")
}
