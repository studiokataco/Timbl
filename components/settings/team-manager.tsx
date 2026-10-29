"use client"

import { useOptimistic, useState, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { Check, Loader2, Mail, MoreHorizontal, RotateCcw, Send, UserMinus, UserPlus, X } from "lucide-react"
import { toast } from "sonner"

import { IdentityAvatar } from "@/components/shared/identity-avatar"
import { ListEmpty, ListGroup, ListPanel, ListRow } from "@/components/shared/list-panel"
import { SettingsPage } from "@/components/settings/settings-page"
import { InviteDialog, announceInvite } from "@/components/settings/team-invite-dialog"
import { RolePicker, RoleText, roleWithArticle } from "@/components/settings/team-roles"
import { ago } from "@/components/studio/bits"
import { Section } from "@/components/studio/section"
import { Button } from "@/components/ui/button"
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
import {
  approveAccessRequest,
  createMemberInvite,
  denyAccessRequest,
  revokeMemberInvite,
  updateOrgMember,
  type OrgAccessRequest,
  type OrgInvite,
} from "@/lib/actions/members"
import type { WithId } from "@/lib/firebase/serialize"
import type { User } from "@/lib/schemas"
import type { UserRole } from "@/lib/schemas/_shared"

type Member = WithId<User>

type Props = {
  members: Member[]
  invites: OrgInvite[]
  requests: OrgAccessRequest[]
  currentUserId: string
}

type Confirm = {
  title: string
  body: string
  action: string
  run: () => void
}

type Busy = { id: string; kind: string } | null

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

function joinedLabel(iso?: string) {
  if (!iso) return null
  try {
    return `Joined ${format(parseISO(iso), "d MMM yyyy")}`
  } catch {
    return null
  }
}

export function TeamManager({ members, invites, requests, currentUserId }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<Busy>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [requestRoles, setRequestRoles] = useState<Record<string, UserRole>>({})
  const [optimisticMembers, setMemberRole] = useOptimistic(
    members,
    (state, next: { id: string; role: UserRole }) =>
      state.map((m) => (m.id === next.id ? { ...m, role: next.role } : m)),
  )

  const sorted = [...optimisticMembers].sort(
    (a, b) => Number(b.id === currentUserId) - Number(a.id === currentUserId),
  )
  const active = sorted.filter((m) => m.active !== false)
  const deactivated = sorted.filter((m) => m.active === false)

  const isBusy = (id: string, kind?: string) =>
    pending && busy?.id === id && (kind == null || busy.kind === kind)

  function run(
    target: { id: string; kind: string },
    fn: () => Promise<{ ok: boolean; error?: string }>,
    success: { title: string; description?: string },
    optimistic?: () => void,
  ) {
    setBusy(target)
    startTransition(async () => {
      optimistic?.()
      const res = await fn()
      if (!res.ok) {
        toast.error(res.error ?? "Something went wrong")
        return
      }
      toast.success(success.title, { description: success.description })
      router.refresh()
    })
  }

  function ask(next: Confirm) {
    setConfirm(next)
    setConfirmOpen(true)
  }

  function changeRole(member: Member, role: UserRole) {
    if (role === member.role) return
    const apply = () =>
      run(
        { id: member.id, kind: "role" },
        () => updateOrgMember({ userId: member.id, role }),
        { title: "Role updated", description: `${member.name} is now ${roleWithArticle(role)}.` },
        () => setMemberRole({ id: member.id, role }),
      )
    if (member.id === currentUserId && member.role === "admin" && role !== "admin") {
      ask({
        title: "Give up admin access?",
        body: `You'll become ${roleWithArticle(role)} and lose access to this page straight away. Only another admin can make you an admin again.`,
        action: "Change my role",
        run: apply,
      })
      return
    }
    apply()
  }

  function askDeactivate(member: Member) {
    ask({
      title: `Deactivate ${member.name}?`,
      body: "They won't be able to sign in to this workspace. Their posts and history stay, and you can reactivate them any time.",
      action: "Deactivate",
      run: () =>
        run(
          { id: member.id, kind: "active" },
          () => updateOrgMember({ userId: member.id, active: false }),
          { title: `${member.name} deactivated` },
        ),
    })
  }

  function reactivate(member: Member) {
    run(
      { id: member.id, kind: "active" },
      () => updateOrgMember({ userId: member.id, active: true }),
      { title: `${member.name} reactivated` },
    )
  }

  function askRevoke(invite: OrgInvite) {
    ask({
      title: `Revoke the invite for ${invite.name}?`,
      body: `${invite.email} won't be able to join with this invite. You can invite them again later.`,
      action: "Revoke invite",
      run: () =>
        run(
          { id: invite.id, kind: "revoke" },
          () => revokeMemberInvite({ email: invite.email }),
          { title: "Invite revoked" },
        ),
    })
  }

  function resend(invite: OrgInvite) {
    setBusy({ id: invite.id, kind: "resend" })
    startTransition(async () => {
      const res = await createMemberInvite({ email: invite.email, name: invite.name, role: invite.role })
      if (!res.ok) {
        toast.error("Couldn't resend the invite", { description: res.error })
        return
      }
      announceInvite(res, invite.email, "Invite sent again")
      router.refresh()
    })
  }

  function approve(req: OrgAccessRequest) {
    const role = requestRoles[req.uid] ?? "contributor"
    run(
      { id: req.uid, kind: "approve" },
      () => approveAccessRequest({ uid: req.uid, role }),
      { title: "Access granted", description: `${req.displayName} joined as ${roleWithArticle(role)}.` },
    )
  }

  function decline(req: OrgAccessRequest) {
    run(
      { id: req.uid, kind: "decline" },
      () => denyAccessRequest({ uid: req.uid }),
      { title: "Request declined" },
    )
  }

  const description = [
    plural(active.length, "person has access", "people have access"),
    invites.length > 0 && plural(invites.length, "invite waiting", "invites waiting"),
  ]
    .filter(Boolean)
    .join(" · ")

  const inviteButton = (
    <Button className="h-9" onClick={() => setInviteOpen(true)}>
      <UserPlus aria-hidden />
      <span className="sm:hidden">Invite</span>
      <span className="hidden sm:inline">Invite people</span>
    </Button>
  )

  return (
    <SettingsPage
      title="Members"
      description={`${description}. Choose what each person can do and approve anyone who asks to join.`}
      action={inviteButton}
    >
      {requests.length > 0 && (
        <Section
          id="settings-team-needs"
          title="Needs you"
          count={requests.length}
          summary={plural(requests.length, "person asked to join", "people asked to join")}
          className="mb-8"
        >
          <ListPanel>
            <ListGroup label="Asked to join">
              {requests.map((req) => {
                const role = requestRoles[req.uid] ?? "contributor"
                const rowBusy = isBusy(req.uid)
                return (
                  <li
                    key={req.id}
                    className="flex flex-col gap-2.5 px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <IdentityAvatar name={req.displayName} src={req.photoURL} shape="circle" initials={2} />
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-foreground">{req.displayName}</p>
                        <p className="truncate text-[13px] text-muted-foreground">
                          {req.email}
                          {req.requestedAt ? ` · asked ${ago(req.requestedAt)}` : null}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 pl-11 sm:pl-0">
                      <RolePicker
                        label={`Role for ${req.displayName}`}
                        value={role}
                        disabled={rowBusy}
                        onChange={(r) => setRequestRoles((m) => ({ ...m, [req.uid]: r }))}
                      />
                      <Button
                        className="h-9 md:h-8"
                        disabled={rowBusy}
                        onClick={() => approve(req)}
                        aria-label={`Approve ${req.displayName} as ${roleWithArticle(role)}`}
                      >
                        {isBusy(req.uid, "approve") ? (
                          <Loader2 className="motion-safe:animate-spin" aria-hidden />
                        ) : (
                          <Check aria-hidden />
                        )}
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        className="h-9 min-w-9 md:h-8 md:min-w-8"
                        disabled={rowBusy}
                        onClick={() => decline(req)}
                        aria-label={`Decline ${req.displayName}`}
                      >
                        {isBusy(req.uid, "decline") ? (
                          <Loader2 className="motion-safe:animate-spin" aria-hidden />
                        ) : (
                          <X aria-hidden />
                        )}
                        <span className="hidden sm:inline">Decline</span>
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ListGroup>
          </ListPanel>
        </Section>
      )}

      {members.length === 0 && invites.length === 0 ? (
        <ListPanel>
          <ListEmpty
            title="No one here yet"
            body="Invite teammates by email. They join by signing in with Google using that address."
            action={inviteButton}
          />
        </ListPanel>
      ) : (
        <ListPanel>
          {active.length > 0 && (
            <ListGroup label="Members" count={active.length}>
              {active.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  isYou={m.id === currentUserId}
                  busy={isBusy(m.id)}
                  onRole={(role) => changeRole(m, role)}
                  onDeactivate={() => askDeactivate(m)}
                  onReactivate={() => reactivate(m)}
                />
              ))}
            </ListGroup>
          )}

          {invites.length > 0 && (
            <ListGroup label="Invited" count={invites.length}>
              {invites.map((inv) => (
                <ListRow
                  key={inv.id}
                  leading={
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                      <Mail className="size-4" aria-hidden />
                    </span>
                  }
                  title={inv.name}
                  subtitle={inv.email}
                  meta={
                    <>
                      <span>{inv.invitedAt ? `Invited ${ago(inv.invitedAt)}` : "Invited"}</span>
                      {inv.invitedByName ? <span>by {inv.invitedByName}</span> : null}
                    </>
                  }
                  actions={
                    <>
                      <RoleText role={inv.role} />
                      <RowMenu label={`More actions for the invite to ${inv.name}`} busy={isBusy(inv.id)}>
                        <DropdownMenuItem className="py-2 md:py-1.5" onClick={() => resend(inv)}>
                          <Send aria-hidden />
                          Resend invite
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          className="py-2 md:py-1.5"
                          onClick={() => askRevoke(inv)}
                        >
                          <X aria-hidden />
                          Revoke invite
                        </DropdownMenuItem>
                      </RowMenu>
                    </>
                  }
                />
              ))}
            </ListGroup>
          )}

          {deactivated.length > 0 && (
            <ListGroup label="Deactivated" count={deactivated.length}>
              {deactivated.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  isYou={m.id === currentUserId}
                  busy={isBusy(m.id)}
                  onRole={(role) => changeRole(m, role)}
                  onDeactivate={() => askDeactivate(m)}
                  onReactivate={() => reactivate(m)}
                />
              ))}
            </ListGroup>
          )}
        </ListPanel>
      )}

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} onInvited={() => router.refresh()} />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-[15px] font-semibold">{confirm?.title}</DialogTitle>
            <DialogDescription className="text-[13px]">{confirm?.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" className="h-9" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="h-9"
              onClick={() => {
                confirm?.run()
                setConfirmOpen(false)
              }}
            >
              {confirm?.action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsPage>
  )
}

function MemberRow({
  member,
  isYou,
  busy,
  onRole,
  onDeactivate,
  onReactivate,
}: {
  member: Member
  isYou: boolean
  busy: boolean
  onRole: (role: UserRole) => void
  onDeactivate: () => void
  onReactivate: () => void
}) {
  const active = member.active !== false
  return (
    <ListRow
      muted={!active}
      leading={
        <IdentityAvatar
          name={member.name}
          src={member.avatarUrl}
          shape="circle"
          initials={2}
          className={active ? undefined : "opacity-60"}
        />
      }
      title={member.name}
      badge={
        isYou ? (
          <span className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[12px] font-medium text-muted-foreground">
            You
          </span>
        ) : null
      }
      subtitle={member.email}
      meta={joinedLabel(member.createdAt)}
      actions={
        <>
          <RolePicker
            label={`Role for ${member.name}`}
            value={member.role}
            disabled={busy}
            onChange={onRole}
          />
          {isYou ? (
            <span aria-hidden className="size-9 shrink-0 md:size-8" />
          ) : (
            <RowMenu label={`More actions for ${member.name}`} busy={busy}>
              {active ? (
                <DropdownMenuItem variant="destructive" className="py-2 md:py-1.5" onClick={onDeactivate}>
                  <UserMinus aria-hidden />
                  Deactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem className="py-2 md:py-1.5" onClick={onReactivate}>
                  <RotateCcw aria-hidden />
                  Reactivate
                </DropdownMenuItem>
              )}
            </RowMenu>
          )}
        </>
      }
    />
  )
}

function RowMenu({
  label,
  busy,
  children,
}: {
  label: string
  busy: boolean
  children: ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-9 text-muted-foreground md:size-8"
            aria-label={label}
            disabled={busy}
          />
        }
      >
        {busy ? <Loader2 className="motion-safe:animate-spin" aria-hidden /> : <MoreHorizontal aria-hidden />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
