"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import {
  Info,
  LifeBuoy,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { RolePill as SharedRolePill } from "@/components/common/role-pill"
import {
  grantPlatformAdmin,
  revokePlatformAdmin,
} from "@/lib/actions/platform/admins"
import { ROOT_PLATFORM_ADMIN_EMAIL } from "@/lib/platform/schema"
import {
  PLATFORM_ROLES,
  ROLE_META,
  type PlatformRole,
} from "@/lib/auth/platform-rbac"
import { relativeTime } from "@/lib/platform/format"

export interface AdminRow {
  email: string
  role: PlatformRole
  grantedBy: string
  grantedAt: string
}

const ROLE_ICON: Record<PlatformRole, LucideIcon> = {
  owner: ShieldCheck,
  admin: SlidersHorizontal,
  support: LifeBuoy,
}

function emailMonogram(email: string): string {
  const handle = email.split("@")[0] ?? email
  return handle.slice(0, 2).toUpperCase() || "?"
}

function RolePill({ role }: { role: PlatformRole }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <SharedRolePill
            label={ROLE_META[role].label}
            tone={ROLE_META[role].tone}
            icon={ROLE_ICON[role]}
            className="cursor-help"
          />
        }
      />
      <TooltipContent>{ROLE_META[role].description}</TooltipContent>
    </Tooltip>
  )
}

export function TeamManager({
  admins,
  canManage,
}: {
  admins: AdminRow[]
  canManage: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<PlatformRole>("support")

  const grant = () =>
    start(async () => {
      const res = await grantPlatformAdmin({ email, role })
      if (res.ok) {
        toast.success(`${email} added as ${ROLE_META[role].label}`)
        setEmail("")
        router.refresh()
      } else {
        toast.error(`Could not add admin: ${res.error ?? "unknown"}`)
      }
    })

  const revoke = (target: string) =>
    start(async () => {
      const res = await revokePlatformAdmin({ email: target })
      if (res.ok) {
        toast.success(`${target} removed`)
        router.refresh()
      } else {
        toast.error(`Could not remove: ${res.error ?? "unknown"}`)
      }
    })

  return (
    <TooltipProvider>
    <div className="flex flex-col gap-8">
      {canManage ? (
        <section className="rounded-xl bg-card ring-1 ring-foreground/10">
          <header className="border-b border-foreground/5 px-4 py-3">
            <h2 className="font-heading text-sm font-semibold tracking-tight">
              Invite a platform admin
            </h2>
          </header>
          <div className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Email</span>
                <Input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && email && !pending) grant()
                  }}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  Role
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Info className="size-3 cursor-help text-muted-foreground/70" />
                      }
                    />
                    <TooltipContent>{ROLE_META[role].description}</TooltipContent>
                  </Tooltip>
                </span>
                <Select value={role} onValueChange={(v) => setRole(v as PlatformRole)}>
                  <SelectTrigger size="default" className="h-9 min-w-40">
                    <SelectValue>{ROLE_META[role].label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {PLATFORM_ROLES.map((r) => {
                      const Icon = ROLE_ICON[r]
                      return (
                        <SelectItem key={r} value={r}>
                          <Icon className="size-3.5 text-muted-foreground" />
                          {ROLE_META[r].label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </label>
              <Button
                size="lg"
                onClick={grant}
                disabled={pending || !email}
                data-icon="inline-start"
              >
                <UserPlus />
                Add admin
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <p className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground ring-1 ring-foreground/10">
          Only owners can invite or remove platform admins.
        </p>
      )}

      <section className="rounded-xl bg-card ring-1 ring-foreground/10">
        <header className="flex items-center justify-between gap-3 border-b border-foreground/5 px-4 py-3">
          <h2 className="font-heading text-sm font-semibold tracking-tight">
            Platform admins
          </h2>
          {admins.length > 0 ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              {admins.length}
            </span>
          ) : null}
        </header>

        {admins.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Users className="size-5" />
            </span>
            <p className="text-sm font-medium">No platform admins yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              {canManage
                ? "Invite a teammate above to give them access to the control centre."
                : "Once an owner invites teammates, they appear here."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/5 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Member</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Granted by</th>
                <th className="px-4 py-2 text-right font-medium">When</th>
                {canManage ? <th className="w-10 px-4 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => {
                const isRoot = a.email === ROOT_PLATFORM_ADMIN_EMAIL
                return (
                  <tr
                    key={a.email}
                    className="border-b border-foreground/5 transition-colors last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                          {emailMonogram(a.email)}
                        </span>
                        <span className="font-medium">{a.email}</span>
                        {isRoot ? (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            root
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <RolePill role={a.role} />
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{a.grantedBy}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                      {relativeTime(a.grantedAt)}
                    </td>
                    {canManage ? (
                      <td className="px-4 py-2.5 text-right">
                        {isRoot ? null : (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={pending}
                            onClick={() => revoke(a.email)}
                            aria-label={`Remove ${a.email}`}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
    </TooltipProvider>
  )
}
