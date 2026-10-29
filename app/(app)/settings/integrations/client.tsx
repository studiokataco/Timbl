"use client"

import { useState, useTransition, type ReactNode } from "react"
import { Controller, useForm } from "react-hook-form"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { format, parseISO } from "date-fns"
import { ChevronDown, KeyRound, Loader2, MoreHorizontal, Plus, RotateCw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import { ListEmpty, ListPanel, ListRow } from "@/components/shared/list-panel"
import { StatusDot } from "@/components/shared/status-dot"
import { ConfirmDialog, CopyField, LogoTile } from "@/components/settings/integrations-bits"
import { McpConnector } from "@/components/settings/mcp-connector"
import { ago } from "@/components/studio/bits"
import { Section } from "@/components/studio/section"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { createPublicApp, rotateKey } from "@/lib/actions/public-apps"
import { publicScopeSchema, type PublicScope } from "@/lib/auth/public-scopes"
import { parseInto } from "@/lib/forms/zod-form"
import { humanize } from "@/lib/labels/enums"
import type { PublicApp, RateTier } from "@/lib/schemas/publicApp"
import type { PublicAuditKind } from "@/lib/telemetry/public-audit"
import { cn } from "@/lib/utils"
import type { AuditRow } from "./page"

const RESOURCE_LABELS: Record<string, string> = {
  posts: "Posts",
  ideation: "Ideas",
  approvals: "Approvals",
  metrics: "Metrics",
  channels: "Channels",
  categories: "Categories",
  webhooks: "Webhooks",
  inbox: "Inbox",
}

const SCOPE_ACTION_LABELS: Record<PublicScope, string> = {
  "posts:read": "Read",
  "posts:write": "Write",
  "posts:publish": "Publish",
  "ideation:read": "Read",
  "ideation:write": "Write",
  "approvals:read": "Read",
  "approvals:request": "Request",
  "approvals:decide": "Decide",
  "metrics:read": "Read",
  "channels:read": "Read",
  "categories:read": "Read",
  "webhooks:write": "Manage",
  "inbox:read": "Read",
}

const SCOPE_GROUPS = publicScopeSchema.options.reduce<{ resource: string; scopes: PublicScope[] }[]>(
  (groups, scope) => {
    const resource = scope.split(":")[0]
    const group = groups.find((g) => g.resource === resource)
    if (group) group.scopes.push(scope)
    else groups.push({ resource, scopes: [scope] })
    return groups
  },
  [],
)

const RATE_TIER_LABELS: Record<RateTier, string> = {
  free: "Free tier",
  agency: "Agency tier",
  operator: "Operator tier",
}

const AUDIT_LABELS: Record<PublicAuditKind, string> = {
  "posts.create": "Created a post",
  "posts.update": "Updated a post",
  "posts.delete": "Deleted a post",
  "posts.get": "Read a post",
  "posts.list": "Listed posts",
  "posts.schedule": "Scheduled a post",
  "posts.unschedule": "Unscheduled a post",
  "posts.publish_now": "Published a post now",
  "posts.edit": "Edited a post",
  "ideation.create": "Added an idea",
  "ideation.list": "Listed ideas",
  "ideation.promote": "Turned an idea into a post",
  "approvals.request": "Asked for approval",
  "approvals.list": "Listed approvals",
  "approvals.decide": "Decided on an approval",
  "categories.list": "Listed categories",
  "channels.list": "Listed channels",
  "channels.get": "Read a channel",
  "metrics.window": "Read metrics",
  "webhooks.subscribe": "Added a webhook",
  "webhooks.list": "Listed webhooks",
  "mcp.tool_call": "Ran an MCP tool",
}

const AUDIT_PREVIEW = 5

const keyFormSchema = z.object({
  name: z.string().trim().min(1, "Give the key a name").max(100, "Keep the name under 100 characters"),
  scopes: z.array(publicScopeSchema).min(1, "Pick at least one permission"),
})
type KeyForm = z.infer<typeof keyFormSchema>

function scopeSummary(scopes: PublicScope[]): string {
  return SCOPE_GROUPS.map((g) => {
    const picked = g.scopes.filter((s) => scopes.includes(s))
    if (picked.length === 0) return null
    const label = RESOURCE_LABELS[g.resource] ?? humanize(g.resource)
    return `${label}: ${picked.map((s) => SCOPE_ACTION_LABELS[s].toLowerCase()).join(", ")}`
  })
    .filter(Boolean)
    .join(" · ")
}

function createdLabel(iso: string | undefined): string {
  if (!iso) return ""
  try {
    return `Created ${format(parseISO(iso), "d MMM yyyy")}`
  } catch {
    return ""
  }
}

interface Props {
  apps: PublicApp[]
  auditRows: AuditRow[]
  revokeAction: (appId: string) => Promise<{ ok: boolean; error?: string }>
}

type Pending = { app: PublicApp; kind: "regenerate" | "revoke" }

export function IntegrationsClient({ apps: initial, auditRows, revokeAction }: Props) {
  const reduced = useReducedMotion()
  const [apps, setApps] = useState(initial)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [revealOpen, setRevealOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [confirm, setConfirm] = useState<Pending | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [mutating, startMutate] = useTransition()
  const [showAllCalls, setShowAllCalls] = useState(false)

  const appNames = new Map(apps.map((a) => [a.id, a.name]))
  const calls = showAllCalls ? auditRows : auditRows.slice(0, AUDIT_PREVIEW)

  function revealKey(key: string | undefined) {
    if (!key) return
    setNewKey(key)
    setRevealOpen(true)
  }

  function onCreated(app: PublicApp, key: string | undefined) {
    setApps((prev) => [app, ...prev])
    revealKey(key)
  }

  function askConfirm(next: Pending) {
    setConfirm(next)
    setConfirmOpen(true)
  }

  function runConfirmed() {
    if (!confirm) return
    const { app, kind } = confirm
    startMutate(async () => {
      if (kind === "regenerate") {
        const result = await rotateKey(app.id)
        if (!result.ok) {
          toast.error(result.error ?? "Couldn't regenerate the key")
          return
        }
        setApps((prev) =>
          prev.map((a) => (a.id === app.id ? { ...a, keyPrefix: (result.key ?? "").slice(0, 14) } : a)),
        )
        revealKey(result.key)
        toast.success("Key regenerated. The old key no longer works.")
      } else {
        const result = await revokeAction(app.id)
        if (!result.ok) {
          toast.error(result.error ?? "Couldn't revoke the key")
          return
        }
        setApps((prev) => prev.filter((a) => a.id !== app.id))
        toast.success(`${app.name} revoked`)
      }
      setConfirmOpen(false)
    })
  }

  return (
    <Section
      id="settings-integrations-api"
      title="API and MCP"
      defaultOpen={false}
      summary={
        apps.length === 0 ? "For developers" : `${apps.length} active ${apps.length === 1 ? "key" : "keys"}`
      }
    >
      <p className="max-w-[64ch] text-[13px] leading-relaxed text-muted-foreground">
        Let your own apps, scripts and AI tools like Cursor and Claude work in this workspace. Most teams never
        need this.
      </p>

      <div className="mt-6 space-y-10">
        <div>
          <SubHeading
            title="API keys"
            hint="Each key only gets the permissions you pick."
            action={
              <Button variant="outline" className="h-9 px-3 text-[13px]" onClick={() => setCreateOpen(true)}>
                <Plus aria-hidden />
                Create key
              </Button>
            }
          />

          <AnimatePresence initial={false}>
            {revealOpen && newKey ? (
              <motion.div
                key="reveal"
                role="status"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="mb-3 rounded-xl border border-border bg-secondary/40 p-4"
              >
                <p className="text-[14px] font-semibold text-foreground">Copy your new key now</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  You won&apos;t see it again. It&apos;s also filled in below for connecting an AI tool.
                </p>
                <div className="mt-3">
                  <CopyField value={newKey} label="Copy API key" />
                </div>
                <div className="mt-3 flex justify-end">
                  <Button variant="ghost" className="h-9 px-3 text-[13px]" onClick={() => setRevealOpen(false)}>
                    I&apos;ve saved it
                  </Button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <ListPanel>
            {apps.length === 0 ? (
              <ListEmpty
                title="No API keys yet"
                body="Create a key when you want a script, automation or AI tool to work in Timbl."
              />
            ) : (
              <ul className="divide-y divide-border">
                {apps.map((app) => (
                  <ListRow
                    key={app.id}
                    leading={
                      <LogoTile className="text-muted-foreground">
                        <KeyRound aria-hidden />
                      </LogoTile>
                    }
                    title={app.name}
                    subtitle={<span title={scopeSummary(app.scopes)}>{scopeSummary(app.scopes)}</span>}
                    meta={
                      <>
                        <span className="font-mono">{app.keyPrefix}…</span>
                        <span>
                          {[RATE_TIER_LABELS[app.rateTier] ?? humanize(app.rateTier), createdLabel(app.createdAt)]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </>
                    }
                    actions={
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon-lg" aria-label={`More options for ${app.name}`} />}
                        >
                          <MoreHorizontal aria-hidden />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 p-1">
                          <DropdownMenuItem
                            className="gap-2 py-1.5 text-[13px]"
                            onClick={() => askConfirm({ app, kind: "regenerate" })}
                          >
                            <RotateCw aria-hidden />
                            Regenerate key
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            className="gap-2 py-1.5 text-[13px]"
                            onClick={() => askConfirm({ app, kind: "revoke" })}
                          >
                            <Trash2 aria-hidden />
                            Revoke key
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    }
                  />
                ))}
              </ul>
            )}
          </ListPanel>
        </div>

        <div>
          <SubHeading
            title="Connect an AI tool"
            hint="Use Timbl from Cursor, Claude or VS Code over MCP, or from the command line."
          />
          <McpConnector apiKey={newKey} />
        </div>

        <div>
          <SubHeading
            title="Recent API calls"
            hint={
              auditRows.length > 0
                ? `The last ${auditRows.length} ${auditRows.length === 1 ? "request" : "requests"} from keys and connected tools.`
                : "Requests from keys and connected tools show up here."
            }
          />
          <ListPanel>
            {auditRows.length === 0 ? (
              <ListEmpty title="No API calls yet" />
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {calls.map((row) => {
                    const appName = appNames.get(row.appId)
                    const when = ago(row.createdAt)
                    return (
                      <ListRow
                        key={row.id}
                        leading={
                          <span className="grid w-4 shrink-0 place-items-center">
                            <StatusDot className={row.success ? "bg-emerald-500" : "bg-rose-500"} />
                          </span>
                        }
                        title={AUDIT_LABELS[row.kind as PublicAuditKind] ?? humanize(row.kind)}
                        subtitle={[
                          row.success ? null : `Failed: ${row.errorCode ? humanize(row.errorCode) : "Error"}`,
                          appName,
                          when,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        meta={<span className="tabular-nums">{row.latencyMs} ms</span>}
                      />
                    )
                  })}
                </ul>
                {auditRows.length > AUDIT_PREVIEW ? (
                  <button
                    type="button"
                    aria-expanded={showAllCalls}
                    onClick={() => setShowAllCalls((v) => !v)}
                    className="flex min-h-10 w-full items-center gap-2 border-t border-border px-4 text-left text-[13px] text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        "size-3.5 transition-transform duration-200 motion-reduce:transition-none",
                        showAllCalls && "rotate-180",
                      )}
                    />
                    {showAllCalls ? "Show fewer" : `Show all ${auditRows.length}`}
                  </button>
                ) : null}
              </>
            )}
          </ListPanel>
        </div>
      </div>

      <CreateKeyDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={onCreated} />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => !open && !mutating && setConfirmOpen(false)}
        title={
          confirm?.kind === "regenerate"
            ? `Regenerate the key for ${confirm.app.name}?`
            : `Revoke ${confirm?.app.name ?? "this key"}?`
        }
        description={
          confirm?.kind === "regenerate"
            ? "The current key stops working right away. You'll see the new one once, so update your app straight after."
            : "Anything using this key stops working right away. This can't be undone."
        }
        confirmLabel={confirm?.kind === "regenerate" ? "Regenerate" : "Revoke"}
        pending={mutating}
        onConfirm={runConfirmed}
      />
    </Section>
  )
}

function SubHeading({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
        {hint ? <p className="mt-0.5 text-[13px] text-muted-foreground">{hint}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

function CreateKeyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (app: PublicApp, key: string | undefined) => void
}) {
  const [creating, startCreate] = useTransition()
  const form = useForm<KeyForm>({ defaultValues: { name: "", scopes: [] } })
  const { errors } = form.formState

  function close(next: boolean) {
    if (creating) return
    if (!next) form.reset()
    onOpenChange(next)
  }

  const onSubmit = form.handleSubmit((raw) => {
    const values = parseInto(keyFormSchema, raw, form.setError)
    if (!values) return
    startCreate(async () => {
      const result = await createPublicApp(values.name, values.scopes)
      if (!result.ok || !result.appId) {
        toast.error(result.error ?? "Couldn't create the key")
        return
      }
      const now = new Date().toISOString()
      onCreated(
        {
          id: result.appId,
          organizationId: "",
          name: values.name,
          keyPrefix: (result.key ?? "").slice(0, 14),
          keyHash: "",
          keyCiphertext: "",
          scopes: values.scopes,
          rateTier: "free",
          createdBy: "",
          createdAt: now,
          updatedAt: now,
        } as PublicApp,
        result.key,
      )
      toast.success(`${values.name} created`)
      form.reset()
      onOpenChange(false)
    })
  })

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create an API key</DialogTitle>
          <DialogDescription className="text-[13px]">
            Name it after the app or script that will use it, then pick only the permissions it needs.
          </DialogDescription>
        </DialogHeader>

        <form id="create-api-key" onSubmit={onSubmit} noValidate className="grid gap-5">
          <div className="grid gap-1.5">
            <label htmlFor="key-name" className="text-[13px] font-medium text-foreground">
              Name
            </label>
            <Input
              id="key-name"
              placeholder="For example, Zapier automation"
              autoComplete="off"
              aria-invalid={!!errors.name}
              className="h-9"
              {...form.register("name")}
            />
            {errors.name ? (
              <p className="text-[12px] text-rose-600 dark:text-rose-400">{errors.name.message}</p>
            ) : null}
          </div>

          <Controller
            control={form.control}
            name="scopes"
            render={({ field }) => (
              <fieldset className="grid gap-3">
                <legend className="mb-1 text-[13px] font-medium text-foreground">Permissions</legend>
                <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {SCOPE_GROUPS.map((g) => (
                    <div key={g.resource}>
                      <p className="text-[12px] font-medium text-muted-foreground">
                        {RESOURCE_LABELS[g.resource] ?? humanize(g.resource)}
                      </p>
                      <div className="flex flex-wrap gap-x-4">
                        {g.scopes.map((scope) => {
                          const checked = field.value.includes(scope)
                          return (
                            <label
                              key={scope}
                              className="flex min-h-9 cursor-pointer items-center gap-2 text-[13px] text-foreground"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() =>
                                  field.onChange(
                                    checked ? field.value.filter((s) => s !== scope) : [...field.value, scope],
                                  )
                                }
                              />
                              {SCOPE_ACTION_LABELS[scope]}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {errors.scopes ? (
                  <p className="text-[12px] text-rose-600 dark:text-rose-400">{errors.scopes.message}</p>
                ) : null}
              </fieldset>
            )}
          />
        </form>

        <DialogFooter>
          <Button type="button" variant="ghost" className="h-9" onClick={() => close(false)} disabled={creating}>
            Cancel
          </Button>
          <Button type="submit" form="create-api-key" className="h-9" disabled={creating}>
            {creating && <Loader2 className="animate-spin" aria-hidden />}
            Create key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
