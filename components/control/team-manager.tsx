"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  grantPlatformAdmin,
  revokePlatformAdmin,
} from "@/lib/actions/platform/admins"
import { ROOT_PLATFORM_ADMIN_EMAIL } from "@/lib/platform/schema"
import { relativeTime } from "@/lib/platform/format"
import { cn } from "@/lib/utils"

export interface AdminRow {
  email: string
  role: "owner" | "analyst"
  grantedBy: string
  grantedAt: string
}

const ROLE_TONE: Record<string, string> = {
  owner: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  analyst: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
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
  const [role, setRole] = useState<"owner" | "analyst">("analyst")

  const grant = () =>
    start(async () => {
      const res = await grantPlatformAdmin({ email, role })
      if (res.ok) {
        toast.success(`${email} added as ${role}`)
        setEmail("")
        router.refresh()
      } else {
        toast.error(`Grant failed: ${res.error ?? "unknown"}`)
      }
    })

  const revoke = (target: string) =>
    start(async () => {
      const res = await revokePlatformAdmin({ email: target })
      if (res.ok) {
        toast.success(`${target} removed`)
        router.refresh()
      } else {
        toast.error(`Revoke failed: ${res.error ?? "unknown"}`)
      }
    })

  return (
    <div className="flex flex-col gap-6">
      {canManage ? (
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="mb-3 font-heading text-sm font-semibold tracking-tight">
            Invite a team member
          </h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Email</span>
              <Input
                type="email"
                placeholder="employee@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Role</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "owner" | "analyst")}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="analyst">Analyst (read-only)</option>
                <option value="owner">Owner (full god-mode)</option>
              </select>
            </label>
            <Button onClick={grant} disabled={pending || !email}>
              Add
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Analysts can view every dashboard and tenant but cannot mutate,
            impersonate, or manage the team. Owners can do everything.
          </p>
        </div>
      ) : (
        <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground ring-1 ring-foreground/10">
          You have read-only (analyst) access. Only owners can manage the team.
        </p>
      )}

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Member</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Granted by</th>
              <th className="px-3 py-2 text-right font-medium">When</th>
              {canManage ? <th className="px-3 py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => {
              const isRoot = a.email === ROOT_PLATFORM_ADMIN_EMAIL
              return (
                <tr key={a.email} className="border-t border-foreground/5">
                  <td className="px-3 py-2 font-medium">
                    {a.email}
                    {isRoot ? (
                      <span className="ml-2 text-xs text-muted-foreground">root</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", ROLE_TONE[a.role])}>
                      {a.role}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{a.grantedBy}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {relativeTime(a.grantedAt)}
                  </td>
                  {canManage ? (
                    <td className="px-3 py-2 text-right">
                      {isRoot ? null : (
                        <button
                          onClick={() => revoke(a.email)}
                          disabled={pending}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
                        >
                          <Trash2 className="size-3.5" /> Remove
                        </button>
                      )}
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
