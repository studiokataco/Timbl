"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { UserRole } from "@/lib/schemas/_shared"
import { cn } from "@/lib/utils"

export const ROLES: UserRole[] = ["admin", "editor", "contributor"]

export const ROLE_COPY: Record<UserRole, { label: string; detail: string }> = {
  admin: { label: "Admin", detail: "Full control of the workspace, billing and members." },
  editor: { label: "Editor", detail: "Creates, edits and approves content." },
  contributor: { label: "Contributor", detail: "Drafts content for review." },
}

export function roleWithArticle(role: UserRole) {
  const label = ROLE_COPY[role].label.toLowerCase()
  return role === "contributor" ? `a ${label}` : `an ${label}`
}

export function RolePicker({
  value,
  onChange,
  label,
  disabled,
}: {
  value: UserRole
  onChange: (role: UserRole) => void
  label: string
  disabled?: boolean
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as UserRole)
      }}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label={`${label}: ${ROLE_COPY[value].label}`}
        className="w-28 text-[13px] data-[size=default]:h-9 md:data-[size=default]:h-8"
      >
        <SelectValue>{ROLE_COPY[value].label}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end" alignItemWithTrigger={false} className="p-1">
        {ROLES.map((r) => (
          <SelectItem key={r} value={r} className="py-2">
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px] font-medium text-foreground">{ROLE_COPY[r].label}</span>
              <span className="text-[12px] text-muted-foreground">{ROLE_COPY[r].detail}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function RoleText({ role, className }: { role: UserRole; className?: string }) {
  return (
    <span
      className={cn(
        "flex h-9 w-28 shrink-0 items-center px-2.5 text-[13px] text-muted-foreground md:h-8",
        className,
      )}
    >
      {ROLE_COPY[role].label}
    </span>
  )
}
