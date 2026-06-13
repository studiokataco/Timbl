"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { createPublicApp } from "@/lib/actions/public-apps"
import { publicScopeSchema, type PublicScope } from "@/lib/auth/public-scopes"
import type { PublicApp } from "@/lib/schemas/publicApp"
import type { AuditRow } from "./page"

const ALL_SCOPES = publicScopeSchema.options as PublicScope[]

interface Props {
  apps: PublicApp[]
  auditRows: AuditRow[]
  revokeAction: (appId: string) => Promise<{ ok: boolean; error?: string }>
}

export function IntegrationsClient({ apps: initial, auditRows, revokeAction }: Props) {
  const [apps, setApps] = useState(initial)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [scopes, setScopes] = useState<PublicScope[]>([])
  const [creating, startCreate] = useTransition()
  const [revoking, startRevoke] = useTransition()

  function toggleScope(scope: PublicScope) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    )
  }

  function handleCreate() {
    if (!name.trim()) { toast.error("Name is required"); return }
    if (scopes.length === 0) { toast.error("Select at least one scope"); return }
    startCreate(async () => {
      const result = await createPublicApp(name.trim(), scopes)
      if (!result.ok) { toast.error(result.error ?? "Failed to create key"); return }
      setNewKey(result.key ?? null)
      setApps((prev) => [...prev])
      setName("")
      setScopes([])
      toast.success("API key created")
    })
  }

  function handleRevoke(appId: string) {
    startRevoke(async () => {
      const result = await revokeAction(appId)
      if (!result.ok) { toast.error(result.error ?? "Failed to revoke"); return }
      setApps((prev) => prev.filter((a) => a.id !== appId))
      toast.success("Key revoked")
    })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>API keys</CardTitle>
        </CardHeader>
        <CardContent>
          {apps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active API keys.</p>
          ) : (
            <div className="divide-y divide-border">
              {apps.map((app) => (
                <div key={app.id} className="flex items-start justify-between py-3 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{app.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {app.keyPrefix}... - created {(app.createdAt ?? "").slice(0, 10)}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {app.scopes.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                      <Badge variant="outline" className="text-xs">{app.rateTier}</Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive hover:text-destructive"
                    disabled={revoking}
                    onClick={() => handleRevoke(app.id)}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create API key</CardTitle>
        </CardHeader>
        <CardContent>
          {newKey && (
            <div className="mb-4 p-3 rounded-lg bg-muted border border-border">
              <p className="text-xs text-muted-foreground mb-1">
                Copy this key now - it will not be shown again.
              </p>
              <code className="text-sm font-mono break-all select-all">{newKey}</code>
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                placeholder="e.g. My automation"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Scopes</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ALL_SCOPES.map((scope) => (
                  <label key={scope} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={scopes.includes(scope)}
                      onCheckedChange={() => toggleScope(scope)}
                    />
                    <span className="text-sm">{scope}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Creating..." : "Create key"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent API usage</CardTitle>
        </CardHeader>
        <CardContent>
          {auditRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No API calls recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left pb-2 pr-4 font-medium">Action</th>
                    <th className="text-left pb-2 pr-4 font-medium">Status</th>
                    <th className="text-right pb-2 pr-4 font-medium">Latency</th>
                    <th className="text-left pb-2 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {auditRows.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2 pr-4 font-mono text-xs">{row.kind}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={row.success ? "secondary" : "destructive"} className="text-xs">
                          {row.success ? "ok" : (row.errorCode ?? "error")}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-right text-muted-foreground">{row.latencyMs}ms</td>
                      <td className="py-2 text-muted-foreground text-xs">
                        {row.createdAt.slice(0, 19).replace("T", " ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
