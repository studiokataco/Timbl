"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { can, ROLE_META, type PlatformRole } from "@/lib/auth/platform-rbac"
import {
  deleteOrganization,
  renameOrganization,
  setOrgStatus,
} from "@/lib/actions/platform/orgs"
import { setOrgPlan } from "@/lib/actions/platform/plans"
import { setOrgQuotaOverride } from "@/lib/actions/platform/quotas"
import { startImpersonation } from "@/lib/actions/platform/impersonation"
import { setTrial } from "@/lib/actions/platform/lifecycle"
import { setFeatureFlag } from "@/lib/actions/platform/flags"
import {
  FEATURE_FLAG_LABEL,
  KNOWN_FEATURE_FLAGS,
} from "@/lib/plans/feature-flags"

type Result = { ok: boolean; error?: string }

const PLAN_IDS = ["free_v1", "studio_v1", "agency_v1", "scale_v1"]
const METRICS = ["agentRuns", "scheduledPosts", "brands", "seats"] as const
const RETENTION_DAYS = 60

export function TenantControls({
  role,
  orgId,
  name,
  plan,
  status,
  suspendedAt,
  billingStatus,
  trialEndsAt,
  featureFlags,
}: {
  role: PlatformRole
  orgId: string
  name: string
  plan: string
  status: "active" | "suspended"
  suspendedAt: string | null
  billingStatus: string | null
  trialEndsAt: string | null
  featureFlags: Record<string, boolean>
}) {
  const actor = { role }
  const canRename = can(actor, "tenants:manage")
  const canPlan = can(actor, "plans:manage")
  const canStatus = can(actor, "tenants:status")
  const canQuota = can(actor, "quotas:manage")
  const canTrial = can(actor, "trials:manage")
  const canFlags = can(actor, "flags:manage")
  const canImpersonate = can(actor, "impersonation:start")
  const canDelete = can(actor, "tenants:delete")

  const router = useRouter()
  const [pending, start] = useTransition()
  const [nameValue, setNameValue] = useState(name)
  const [planId, setPlanId] = useState(plan)
  const [metric, setMetric] = useState<(typeof METRICS)[number]>("agentRuns")
  const [quotaValue, setQuotaValue] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState("")

  const autoDeleteDate = suspendedAt
    ? new Date(
        new Date(suspendedAt).getTime() + RETENTION_DAYS * 86_400_000,
      ).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null

  const isTrialing = billingStatus === "trialing"
  const trialEndsLabel = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
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
            Tenant controls
          </h2>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_META[role].tone}`}>
            {ROLE_META[role].label}
          </span>
        </header>

        {canRename ? (
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
        ) : null}

        {canPlan ? (
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
        ) : null}

        {canStatus ? (
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
        ) : null}

        {canQuota ? (
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
        ) : null}

        {canTrial ? (
        <ControlRow
          title="Trial"
          hint={
            isTrialing && trialEndsAt
              ? `Trialing - ends ${trialEndsLabel}. Extend adds another 30 days; cancel reverts to Free now.`
              : "Grant a 30-day Agency trial. Reverts to Free at expiry."
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            {isTrialing ? (
              <>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => run("Trial extend", () => setTrial({ orgId, action: "extend" }))}
                >
                  Extend 30 days
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run("Trial cancel", () => setTrial({ orgId, action: "cancel" }))}
                >
                  Cancel trial
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                disabled={pending}
                onClick={() => run("Trial start", () => setTrial({ orgId, action: "start" }))}
              >
                Start 30-day trial
              </Button>
            )}
          </div>
        </ControlRow>
        ) : null}

        {canFlags ? (
        <ControlRow
          title="Feature flags"
          hint="Per-org overrides. A missing flag is off."
        >
          <div className="flex flex-col gap-2">
            {KNOWN_FEATURE_FLAGS.map((flag) => {
              const enabled = featureFlags[flag] === true
              return (
                <div key={flag} className="flex items-center justify-between gap-3">
                  <span className="text-sm">{FEATURE_FLAG_LABEL[flag]}</span>
                  <Button
                    size="sm"
                    variant={enabled ? "destructive" : "default"}
                    disabled={pending}
                    onClick={() =>
                      run(
                        enabled ? "Flag disable" : "Flag enable",
                        () => setFeatureFlag({ orgId, flag, enabled: !enabled }),
                      )
                    }
                  >
                    {enabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              )
            })}
          </div>
        </ControlRow>
        ) : null}

        {canImpersonate ? (
        <ControlRow
          title="Impersonate user"
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
        ) : null}

      </section>

      {canDelete && status === "suspended" ? (
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
