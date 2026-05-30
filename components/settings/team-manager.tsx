"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Mail, Trash2, UserPlus, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
        <p className="text-xs text-muted-foreground max-w-xl">
          Invite teammates by email, approve sign-ins that were not invited, and
          manage roles. Invited users sign in with Google using that exact email.
        </p>
        <Button size="sm" className="shrink-0 gap-1.5" onClick={() => setShowInvite((v) => !v)}>
          <Mail className="h-3.5 w-3.5" />
          Invite by email
        </Button>
      </div>

      {showInvite && (
        <div className="rounded-xl border border-border bg-canvas p-4 space-y-3">
          <h2 className="text-sm font-medium">Invite member</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="invite-name">Name</Label>
              <Input
                id="invite-name"
                value={inviteForm.name}
                onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
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
            <Label className="text-xs text-muted-foreground">Role</Label>
            <select
              value={inviteForm.role}
              onChange={(e) =>
                setInviteForm((f) => ({ ...f, role: e.target.value as UserRole }))
              }
              className="rounded-md border border-border bg-background px-2 py-1 text-xs capitalize"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
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
              onClick={() =>
                run(
                  () => createMemberInvite(inviteForm),
                  "Invite saved",
                )
              }
            >
              Save invite
            </Button>
          </div>
        </div>
      )}

      {requests.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
          <h2 className="text-sm font-medium text-blue-900 flex items-center gap-1.5">
            <UserPlus className="h-4 w-4" />
            Access requests ({requests.length})
          </h2>
          {requests.map((req) => {
            const role = requestRoles[req.uid] ?? "contributor"
            return (
              <div
                key={req.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg bg-white border border-blue-200 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{req.displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{req.email}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <select
                    value={role}
                    onChange={(e) =>
                      setRequestRoles((m) => ({
                        ...m,
                        [req.uid]: e.target.value as UserRole,
                      }))
                    }
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs capitalize"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    disabled={pending}
                    className="gap-1"
                    onClick={() =>
                      run(
                        () => approveAccessRequest({ uid: req.uid, role }),
                        "Access granted",
                      )
                    }
                  >
                    <Check className="h-3.5 w-3.5" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    className="gap-1"
                    onClick={() =>
                      run(() => denyAccessRequest({ uid: req.uid }), "Request denied")
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                    Deny
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {invites.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <h2 className="text-sm font-medium text-amber-900">
            Pending invites ({invites.length})
          </h2>
          {invites.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg bg-white border border-amber-200 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {inv.name}{" "}
                  <span className="text-xs uppercase text-amber-700">({inv.role})</span>
                </p>
                <p className="text-xs text-muted-foreground truncate">{inv.email}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                className="gap-1"
                onClick={() =>
                  run(() => revokeMemberInvite({ email: inv.email }), "Invite revoked")
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="lg:w-80 shrink-0 space-y-1.5">
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedId(m.id)}
              className={`w-full text-left rounded-lg border p-3 transition-colors ${
                selectedId === m.id
                  ? "border-foreground/20 bg-muted/30"
                  : "border-border hover:bg-muted/20"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    m.active !== false ? "bg-green-500" : "bg-muted-foreground"
                  }`}
                />
                <span className="text-sm font-medium truncate">{m.name}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                  {m.role}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground ml-4 truncate">{m.email}</p>
            </button>
          ))}
          {members.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">No members yet.</p>
          )}
        </div>

        {selected ? (
          <div className="flex-1 rounded-xl border border-border bg-canvas p-4 space-y-4">
            <div>
              <h2 className="font-medium">{selected.name}</h2>
              <p className="text-xs text-muted-foreground">{selected.email}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {selected.active !== false ? "Active" : "Deactivated"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              <Label className="text-xs text-muted-foreground">Role</Label>
              <select
                value={selected.role}
                onChange={(e) =>
                  run(
                    () =>
                      updateOrgMember({
                        userId: selected.id,
                        role: e.target.value as UserRole,
                      }),
                    "Role updated",
                  )
                }
                disabled={pending}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs capitalize"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
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
          members.length > 0 && (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground py-12">
              Select a member
            </div>
          )
        )}
      </div>
    </div>
  )
}
