"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { usePrototype } from "../prototype-context"
import { PRESENCE_RING, tw } from "../lib"
import type { TeamMember } from "../types"

type PersonAvatarProps = { member: TeamMember; size?: "sm" | "default" | "lg"; presenceRing?: boolean; you?: boolean }

export function PersonAvatar({ member, size = "default", presenceRing = false, you = false }: PersonAvatarProps): React.JSX.Element {
  const { copy } = usePrototype()
  return (
    <Avatar
      size={size}
      role="img"
      aria-label={you ? copy.notes.you : member.name}
      data-slot="agentic-person-avatar"
      data-state={presenceRing ? "presence" : "plain"}
      data-figma="PersonAvatar"
      className={tw(presenceRing && "ring-2", presenceRing && PRESENCE_RING[member.presenceSlot])}
    >
      {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}
      <AvatarFallback aria-hidden>
        <span className="text-xs leading-none font-medium">{member.initials}</span>
      </AvatarFallback>
    </Avatar>
  )
}
