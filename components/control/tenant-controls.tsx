"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { deleteOrganization, setOrgStatus } from "@/lib/actions/platform/orgs"
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
  plan,
  status,
  suspendedAt,
}: {
  orgId: string
  plan: string
  status: "active" | "suspended"
  suspendedAt: string | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
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
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Plan">
        <div className="flex items-center gap-2">
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
      </Section>

      <Section title="Status">
        <div className="flex items-center gap-2">
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
        </div>
        {status === "suspended" && autoDeleteDate ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Suspended workspaces are deleted automatically after{" "}
            {RETENTION_DAYS} days - this one on{" "}
            <span className="font-medium text-foreground">{autoDeleteDate}</span>.
            Reactivate to cancel.
          </p>
        ) : null}
      </Section>

      <Section title="Quota override">
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
      </Section>

      <Section title="Support">
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
        <p className="mt-1 text-xs text-muted-foreground">
          Opens the tenant app as this org on the main host. Exit from the
          banner there.
        </p>
      </Section>

      <Section title="Force agent run" full>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="agent name (e.g. drafter)"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            className="h-9 w-48"
          />
          <Input
            placeholder="input"
            value={agentInput}
            onChange={(e) => setAgentInput(e.target.value)}
            className="h-9 flex-1"
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
      </Section>

      {status === "suspended" ? (
        <Section title="Danger zone" full>
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
                    router.refresh()
                  } else {
                    toast.error(`Delete failed: ${res.error ?? "unknown"}`)
                  }
                })
              }
            >
              Delete workspace permanently
            </Button>
          </div>
        </Section>
      ) : null}
    </div>
  )
}

function Section({
  title,
  children,
  full,
}: {
  title: string
  children: React.ReactNode
  full?: boolean
}) {
  return (
    <div
      className={`rounded-xl bg-card p-4 ring-1 ring-foreground/10 ${full ? "lg:col-span-2" : ""}`}
    >
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  )
}
