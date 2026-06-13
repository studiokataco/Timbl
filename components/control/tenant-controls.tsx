"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  deleteOrganization,
  renameOrganization,
  setOrgStatus,
} from "@/lib/actions/platform/orgs"
import { setOrgPlan } from "@/lib/actions/platform/plans"
import { setOrgQuotaOverride } from "@/lib/actions/platform/quotas"
import { forceRunAgent } from "@/lib/actions/platform/agents"
import { startImpersonation } from "@/lib/actions/platform/impersonation"

type Result = { ok: boolean; error?: string }

const PLAN_IDS = ["free_v1", "studio_v1", "agency_v1", "scale_v1"]
const METRICS = ["agentRuns", "scheduledPosts", "brands", "seats"] as const
const RETENTION_DAYS = 60

export function TenantControls({
  orgId,
  name,
  plan,
  status,
  suspendedAt,
}: {
  orgId: string
  name: string
  plan: string
  status: "active" | "suspended"
  suspendedAt: string | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [nameValue, setNameValue] = useState(name)
  const [planId, setPlanId] = useState(plan)
  const [metric, setMetric] = useState<(typeof METRICS)[number]>("agentRuns")
  const [quotaValue, setQuotaValue] = useState("")
  const [agentName, setAgentName] = useState("")
  const [agentInput, setAgentInput] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState("")

  const autoDeleteDate = suspendedAt
    ? new Date(
        new Date(suspendedAt).getTime() + RETENTION_DAYS * 86_400_000,
      ).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null

  const run = (label: string, fn: () => Promise<Result>) =>
    start(async () => {
      const res = await fn()
      if (res.ok) {
        toast.success(`${label} done`)
        router.refresh()
      } else {
        toast.error(`${label} failed: ${res.error ?? "unknown"}`)
      }
    })

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl bg-card ring-1 ring-foreground/10">
        <header className="flex items-center justify-between gap-3 border-b border-foreground/5 px-4 py-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight">
            Admin controls
          </h2>
          <span className="text-xs text-muted-foreground">owner only</span>
        </header>

        <ControlRow
          title="Rename workspace"
          hint="Changes the display name only - the workspace ID is permanent."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              placeholder="Workspace name"
              className="h-9 min-w-48 flex-1"
            />
            <Button
              size="sm"
              disabled={pending || nameValue.trim() === "" || nameValue.trim() === name}
              onClick={() =>
                run("Rename", () => renameOrganization({ orgId, name: nameValue.trim() }))
              }
            >
              Save
            </Button>
          </div>
        </ControlRow>

        <ControlRow title="Plan">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              {PLAN_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={pending || planId === plan}
              onClick={() => run("Plan change", () => setOrgPlan({ orgId, planId }))}
            >
              Change plan
            </Button>
          </div>
        </ControlRow>

        <ControlRow
          title="Status"
          hint={
            status === "suspended" && autoDeleteDate
              ? `Suspended workspaces are deleted automatically after ${RETENTION_DAYS} days - this one on ${autoDeleteDate}. Reactivate to cancel.`
              : undefined
          }
        >
          {status === "active" ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() =>
                run("Suspend", () => setOrgStatus({ orgId, status: "suspended" }))
              }
            >
              Suspend workspace
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run("Reactivate", () => setOrgStatus({ orgId, status: "active" }))
              }
            >
              Reactivate workspace
            </Button>
          )}
        </ControlRow>

        <ControlRow title="Quota override">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as (typeof METRICS)[number])}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              {METRICS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <Input
              type="number"
              placeholder="limit"
              value={quotaValue}
              onChange={(e) => setQuotaValue(e.target.value)}
              className="h-9 w-28"
            />
            <Button
              size="sm"
              disabled={pending || quotaValue === ""}
              onClick={() =>
                run("Quota override", () =>
                  setOrgQuotaOverride({ orgId, metric, value: Number(quotaValue) }),
                )
              }
            >
              Set
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run("Quota clear", () =>
                  setOrgQuotaOverride({ orgId, metric, value: "clear" }),
                )
              }
            >
              Clear
            </Button>
          </div>
        </ControlRow>

        <ControlRow
          title="Support"
          hint="Opens the tenant app as this org on the main host. Exit from the banner there."
        >
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run("Impersonation", async () => {
                const res = await startImpersonation({ orgId })
                if (res.ok) window.location.href = "/calendar"
                return res
              })
            }
          >
            Impersonate (30m)
          </Button>
        </ControlRow>

        <ControlRow title="Force agent run">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="agent name (e.g. drafter)"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="h-9 w-44"
            />
            <Input
              placeholder="input"
              value={agentInput}
              onChange={(e) => setAgentInput(e.target.value)}
              className="h-9 min-w-32 flex-1"
            />
            <Button
              size="sm"
              disabled={pending || !agentName}
              onClick={() =>
                run("Force run", () =>
                  forceRunAgent({ orgId, agentName, input: agentInput || undefined }),
                )
              }
            >
              Run
            </Button>
          </div>
        </ControlRow>
      </section>

      {status === "suspended" ? (
        <section className="rounded-xl bg-card ring-1 ring-red-500/30">
          <header className="border-b border-red-500/15 px-4 py-3">
            <h2 className="font-heading text-sm font-semibold tracking-tight text-red-600 dark:text-red-400">
              Danger zone
            </h2>
          </header>
          <div className="px-4 py-4">
            <p className="mb-3 text-sm text-muted-foreground">
              Permanently delete this workspace and all of its data - posts,
              members, agent history, billing profile. This cannot be undone.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder={`type "${orgId}" to confirm`}
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="h-9 w-64"
              />
              <Button
                size="sm"
                variant="destructive"
                disabled={pending || deleteConfirm !== orgId}
                onClick={() =>
                  start(async () => {
                    const res = await deleteOrganization({
                      orgId,
                      confirm: deleteConfirm,
                    })
                    if (res.ok) {
                      toast.success("Workspace deleted")
                      router.push("/tenants")
                    } else {
                      toast.error(`Delete failed: ${res.error ?? "unknown"}`)
                    }
                  })
                }
              >
                Delete workspace permanently
              </Button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}

function ControlRow({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2.5 border-b border-foreground/5 px-4 py-4 last:border-0">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  )
}
