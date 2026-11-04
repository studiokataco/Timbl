"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PersonAvatar } from "../collab/person-avatar"
import { PRESENCE_BG, TOUCH, tw } from "../lib"
import { usePrototype } from "../prototype-context"
import type { TeamMember } from "../types"

export type PeerItem = {
  member: TeamMember
  activity?: "viewing" | "editing_caption"
}

export type AvatarStackProps = {
  peers: PeerItem[]
  cursorsShown: boolean
  onFollow: (userId: string) => void
  onToggleCursors: () => void
  density?: "touch" | "pointer"
}

export function PeerChip({ member, where }: { member: TeamMember; where: string }): React.JSX.Element {
  const { copy } = usePrototype()
  return (
    <Badge
      variant="outline"
      data-slot="agentic-peer-chip"
      data-figma="PeerChip/root"
      className="gap-1.5"
    >
      <span aria-hidden="true" className={tw("size-2 rounded-full", PRESENCE_BG[member.presenceSlot])} />
      <span>{copy.iface.cursors.elsewhere(member.name, where)}</span>
    </Badge>
  )
}

export function AvatarStack({
  peers,
  cursorsShown,
  onFollow,
  onToggleCursors,
  density = "pointer",
}: AvatarStackProps): React.JSX.Element | null {
  const { copy } = usePrototype()
  const c = copy.iface.cursors
  if (peers.length === 0) return null
  const here = `${peers.length} here`
  const shown = peers.slice(0, 2)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            aria-label={here}
            data-slot="agentic-avatar-stack"
            data-figma="AvatarStack/root"
            className={tw("h-8 gap-1.5 px-1.5", density === "touch" && TOUCH.control)}
          />
        }
      >
        <span className="flex items-center gap-1.5" aria-hidden="true">
          {shown.map(({ member }) => (
            <PersonAvatar key={member.id} member={member} face />
          ))}
        </span>
        <span className="text-caption font-normal text-muted-foreground">{here}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {peers.map(({ member, activity }) => (
          <DropdownMenuItem key={member.id} onClick={() => onFollow(member.id)} className="flex flex-col items-start gap-0.5">
            <span className="text-body-sm font-medium text-foreground">{c.menuFollow(member.name)}</span>
            <span className="text-caption text-muted-foreground">
              {member.name} · {activity === "editing_caption" ? c.editingCaption : c.viewing}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onToggleCursors}>
          {cursorsShown ? c.hideCursors : c.showCursors}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
