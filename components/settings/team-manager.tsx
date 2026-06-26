"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Mail, Trash2, UserPlus, Users, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RolePill } from "@/components/common/role-pill"
import {
  approveAccessRequest,
  createMemberInvite,
  denyAccessRequest,
  revokeMemberInvite,
  updateOrgMember,
  type OrgAccessRequest,
  type OrgInvite,
} from "@/lib/actions/members"
import type { UserRole } from "@/lib/schemas/_shared"
import type { WithId } from "@/lib/firebase/serialize"
import type { User } from "@/lib/schemas"

const ROLES: UserRole[] = ["admin", "editor", "contributor"]

const ROLE_META: Record<UserRole, { label: string; tone: string }> = {
  admin: { label: "Admin", tone: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
  editor: { label: "Editor", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  contributor: { label: "Contributor", tone: "bg-muted text-muted-foreground" },
}

function RoleSelect({
  value,
  onValueChange,
  disabled,
  id,
}: {
  value: UserRole
  onValueChange: (role: UserRole) => void
  disabled?: boolean
  id?: string
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as UserRole)}
      disabled={disabled}
    >
      <SelectTrigger id={id} size="sm" className="min-w-32">
        <SelectValue>{ROLE_META[value].label}</SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {ROLE_META[r].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

type Props = {
  members: WithId<User>[]
  invites: OrgInvite[]
  requests: OrgAccessRequest[]
}

export function TeamManager({ members, invites, requests }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [showInvite, setShowInvite] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(members[0]?.id ?? null)
  const [requestRoles, setRequestRoles] = useState<Record<string, UserRole>>({})
  const [inviteForm, setInviteForm] = useState({
    email: "",
    name: "",
    role: "contributor" as UserRole,
  })

  const selected = members.find((m) => m.id === selectedId)

  function run(
    fn: () => Promise<{ ok: boolean; error?: string; emailSent?: boolean; emailError?: string }>,
    okMsg: string,
  ) {
    startTransition(async () => {
      const res = await fn()
      if (res.ok) {
        if (res.emailSent === false) {
          toast.warning(
            res.emailError
              ? `Invite saved but email failed: ${res.emailError}`
              : "Invite saved but email was not sent (Resend not configured).",
          )
        } else {
          toast.success(res.emailSent ? `${okMsg} - email sent` : okMsg)
        }
        router.refresh()
      } else toast.error(res.error ?? "Something went wrong")
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="max-w-xl text-xs text-muted-foreground">
          Invite teammates by email, approve sign-ins that were not invited, and
          manage roles. Invited users sign in with Google using that exact email.
        </p>
        <Button
          size="sm"
          className="shrink-0"
          data-icon="inline-start"
          onClick={() => setShowInvite((v) => !v)}
        >
          <Mail />
          Invite by email
        </Button>
      </div>

      {showInvite && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Invite member</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">Name</Label>
              <Input
                id="invite-name"
                value={inviteForm.name}
                onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="invite-role" className="text-xs text-muted-foreground">
              Role
            </Label>
            <RoleSelect
              id="invite-role"
              value={inviteForm.role}
              onValueChange={(role) => setInviteForm((f) => ({ ...f, role }))}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Sends an invite email when Resend is configured. With test mode, mail
            goes to the Resend sandbox inbox, not the recipient. They must sign
            in with Google using this exact address.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowInvite(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={pending || !inviteForm.email || !inviteForm.name}
              onClick={() => run(() => createMemberInvite(inviteForm), "Invite saved")}
            >
              Save invite
            </Button>
          </div>
        </div>
      )}

      {requests.length > 0 && (
        <div className="space-y-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-blue-700 dark:text-blue-400">
            <UserPlus className="size-4" />
            Access requests ({requests.length})
          </h2>
          {requests.map((req) => {
            const role = requestRoles[req.uid] ?? "contributor"
            return (
              <div
                key={req.id}
                className="flex flex-col gap-2 rounded-lg border border-foreground/10 bg-card p-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{req.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{req.email}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <RoleSelect
                    value={role}
                    onValueChange={(r) =>
                      setRequestRoles((m) => ({ ...m, [req.uid]: r }))
                    }
                  />
                  <Button
                    size="sm"
                    disabled={pending}
                    data-icon="inline-start"
                    onClick={() =>
                      run(() => approveAccessRequest({ uid: req.uid, role }), "Access granted")
                    }
                  >
                    <Check />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    data-icon="inline-start"
                    onClick={() =>
                      run(() => denyAccessRequest({ uid: req.uid }), "Request denied")
                    }
                  >
                    <X />
                    Deny
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {invites.length > 0 && (
        <div className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <h2 className="text-sm font-medium text-amber-700 dark:text-amber-500">
            Pending invites ({invites.length})
          </h2>
          {invites.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-col gap-2 rounded-lg border border-foreground/10 bg-card p-3 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate text-sm font-medium">{inv.name}</span>
                <RolePill label={ROLE_META[inv.role].label} tone={ROLE_META[inv.role].tone} />
              </div>
              <p className="truncate text-xs text-muted-foreground sm:flex-1">{inv.email}</p>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                data-icon="inline-start"
                onClick={() =>
                  run(() => revokeMemberInvite({ email: inv.email }), "Invite revoked")
                }
              >
                <Trash2 />
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}

      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border py-14 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Users className="size-5" />
          </span>
          <p className="text-sm font-medium">No members yet</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Invite a teammate by email to get started.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="shrink-0 space-y-1.5 lg:w-80">
            {members.map((m) => {
              const active = m.active !== false
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selectedId === m.id
                      ? "border-foreground/20 bg-muted/40"
                      : "border-border hover:bg-muted/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${
                        active ? "bg-emerald-500" : "bg-muted-foreground/50"
                      }`}
                    />
                    <span className="truncate text-sm font-medium">{m.name}</span>
                    <RolePill
                      label={ROLE_META[m.role].label}
                      tone={ROLE_META[m.role].tone}
                      className="ml-auto"
                    />
                  </div>
                  <p className="ml-3.5 truncate text-xs text-muted-foreground">{m.email}</p>
                </button>
              )
            })}
          </div>

          {selected ? (
            <div className="flex-1 space-y-4 rounded-xl border border-border bg-card p-4">
              <div>
                <h2 className="font-medium">{selected.name}</h2>
                <p className="text-xs text-muted-foreground">{selected.email}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selected.active !== false ? "Active" : "Deactivated"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Label htmlFor="member-role" className="text-xs text-muted-foreground">
                  Role
                </Label>
                <RoleSelect
                  id="member-role"
                  value={selected.role}
                  disabled={pending}
                  onValueChange={(role) =>
                    run(
                      () => updateOrgMember({ userId: selected.id, role }),
                      "Role updated",
                    )
                  }
                />
                <Button
                  size="sm"
                  variant={selected.active !== false ? "outline" : "default"}
                  className="ml-auto"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () =>
                        updateOrgMember({
                          userId: selected.id,
                          active: selected.active === false,
                        }),
                      selected.active !== false ? "Member deactivated" : "Member activated",
                    )
                  }
                >
                  {selected.active !== false ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center py-12 text-sm text-muted-foreground">
              Select a member
            </div>
          )}
        </div>
      )}
    </div>
  )
}
