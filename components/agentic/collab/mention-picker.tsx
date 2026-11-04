"use client"

import { usePrototype } from "../prototype-context"
import { tw } from "../lib"
import { PersonAvatar } from "./person-avatar"
import type { TeamMember } from "../types"

type MentionPickerProps = { query: string | null; team: TeamMember[]; activeIndex: number; listId: string; onPick: (member: TeamMember) => void; onClose: () => void }
type MentionListProps = { team: TeamMember[]; query: string; activeIndex: number; onPick: (m: TeamMember) => void; id: string }

const MAX_MATCHES = 5

export function matchMembers(team: TeamMember[], query: string): TeamMember[] {
  const q = query.trim().toLowerCase()
  const hits = team.filter((m) => {
    if (!q) return true
    const name = m.name.toLowerCase()
    return name.startsWith(q) || name.split(/\s+/).some((word) => word.startsWith(q))
  })
  return hits.slice(0, MAX_MATCHES)
}

export function mentionOptionId(listId: string, member: TeamMember): string {
  return `${listId}-${member.id}`
}

export function MentionList({ team, query, activeIndex, onPick, id }: MentionListProps): React.JSX.Element {
  const { copy } = usePrototype()
  const matches = matchMembers(team, query)
  return (
    <ul
      id={id}
      role="listbox"
      aria-label={copy.notes.mention}
      data-slot="agentic-mention-list"
      data-state={matches.length === 0 ? "empty" : "open"}
      data-figma="MentionList"
      className="flex flex-col gap-0.5 p-1"
    >
      {matches.length === 0 ? (
        <li role="presentation" className="text-caption px-2 py-1.5 text-muted-foreground">
          {copy.notes.mentionNone}
        </li>
      ) : (
        matches.map((member, i) => (
          <li
            key={member.id}
            id={mentionOptionId(id, member)}
            role="option"
            aria-selected={i === activeIndex}
            data-figma="MentionList/option"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(member)}
            className={tw(
              "flex cursor-default items-center gap-2 rounded-md px-2 py-1.5",
              i === activeIndex ? "bg-muted" : "hover:bg-muted",
            )}
          >
            <span aria-hidden className="flex">
              <PersonAvatar member={member} size="sm" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-body-sm truncate font-medium text-foreground">{member.name}</span>
              <span className="text-caption truncate text-muted-foreground">{copy.roles[member.role]}</span>
            </span>
          </li>
        ))
      )}
    </ul>
  )
}

export function MentionPicker({ query, team, activeIndex, listId, onPick }: MentionPickerProps): React.JSX.Element | null {
  if (query === null) return null
  return (
    <div
      data-slot="agentic-mention-picker"
      data-state="open"
      data-figma="MentionPicker"
      className="absolute bottom-full left-0 z-10 mb-2 w-72 rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
    >
      <MentionList team={team} query={query} activeIndex={activeIndex} onPick={onPick} id={listId} />
    </div>
  )
}
