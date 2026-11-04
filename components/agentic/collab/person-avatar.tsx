"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { usePrototype } from "../prototype-context"
import { PRESENCE_RING, tw } from "../lib"
import type { PresenceSlot, TeamMember } from "../types"

type PersonAvatarProps = { member: TeamMember; size?: "sm" | "default" | "lg"; presenceRing?: boolean; you?: boolean; face?: boolean }

const FACE: Record<PresenceSlot, { back: string; shirt: string; hair: string }> = {
  1: { back: "#E6EEF5", shirt: "#C5D4E4", hair: "M9 11.2c.4-3.8 2-5.4 5-5.4s4.6 1.6 5 5.4c-1.2-1.7-2.9-2.5-5-2.5s-3.8.8-5 2.5Z" },
  2: { back: "#F4EBE6", shirt: "#E4D0C6", hair: "M8 11.6c.5-4.4 2.6-6.2 6-6.2s5.5 1.8 6 6.2c-1.6-2-3.6-3-6-3s-4.4 1-6 3Z" },
  3: { back: "#E8F0E8", shirt: "#D5E0D4", hair: "M7.4 12c.6-5 3-7 6.6-7s6 2 6.6 7c-1.8-2.2-4-3.2-6.6-3.2S9.2 9.8 7.4 12Z" },
  4: { back: "#F6EFE8", shirt: "#E6D3C4", hair: "M9.4 10.8c.3-3.2 1.8-4.8 4.6-4.8s4.3 1.6 4.6 4.8c-1-1.4-2.6-2.1-4.6-2.1s-3.6.7-4.6 2.1Z" },
  5: { back: "#ECEAF4", shirt: "#D4D3E6", hair: "M7.2 12.2C8 5.6 11 4.6 14 4.6s6 1 6.8 7.6c-1.8-2.4-4-3.5-6.8-3.5s-5 1.1-6.8 3.5Z" },
  6: { back: "#F5EFE3", shirt: "#E4D3B4", hair: "M8.2 11.4c.4-3.6 2.2-5.6 5.8-5.6s5.4 2 5.8 5.6c-1.4-1.8-3.4-2.7-5.8-2.7s-4.4.9-5.8 2.7Z" },
  7: { back: "#E3F2F0", shirt: "#C5E0DC", hair: "M7.6 12c.5-4.2 2.8-6 6.4-6s5.9 1.8 6.4 6c-1.6-2-3.8-3-6.4-3s-4.8 1-6.4 3Z" },
  8: { back: "#EEF0F3", shirt: "#D3D7DE", hair: "M8.8 11c.3-3.4 2-5 5.2-5s4.9 1.6 5.2 5c-1.2-1.5-3-2.3-5.2-2.3S10 9.5 8.8 11Z" },
}

export function PersonAvatar({ member, size = "default", presenceRing = false, you = false, face = false }: PersonAvatarProps): React.JSX.Element {
  const { copy } = usePrototype()
  const look = FACE[member.presenceSlot]
  return (
    <Avatar
      size={face ? "default" : size}
      role="img"
      aria-label={you ? copy.notes.you : member.name}
      data-slot="agentic-person-avatar"
      data-state={presenceRing && !face ? "presence" : "plain"}
      data-figma="PersonAvatar"
      className={tw(face && "size-7 overflow-hidden", !face && presenceRing && "ring-2", !face && presenceRing && PRESENCE_RING[member.presenceSlot])}
    >
      <AvatarFallback aria-hidden className={face ? "bg-transparent" : undefined}>
        {face ? (
          <svg viewBox="0 0 28 28" className="size-7" aria-hidden>
            <rect width="28" height="28" fill={look.back} />
            <circle cx="14" cy="25" r="9" fill={look.shirt} />
            <circle cx="14" cy="12.2" r="6.6" fill="#F3C7A8" />
            <path d={look.hair} fill="#2C2624" />
            <circle cx="11.6" cy="12.6" r="0.85" fill="#2C2624" />
            <circle cx="16.4" cy="12.6" r="0.85" fill="#2C2624" />
            <path d="M12 15.7c.55.5 1.25.75 2 .75s1.45-.25 2-.75" fill="none" stroke="#A86B58" strokeWidth="0.7" strokeLinecap="round" />
          </svg>
        ) : (
          <span className="text-xs leading-none font-medium">{member.initials}</span>
        )}
      </AvatarFallback>
    </Avatar>
  )
}
