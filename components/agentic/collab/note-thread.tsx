"use client"

import { useEffect, useEffectEvent, useId, useRef, useState } from "react"
import { AtSign, CircleCheck, Ellipsis, MessageSquare, Pencil, SendHorizontal, Trash2, TriangleAlert, Undo2 } from "lucide-react"
import { REJECT_REASON_LABELS } from "@/lib/schemas/_shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DisclosureTrigger } from "@/components/ui/disclosure"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { useAgenticMotion, usePrototype } from "../prototype-context"
import { formatRelative } from "../clock"
import { ASSISTANT_ID } from "../defaults"
import { mentionQueryAt, REDUCED_POPUP, tw } from "../lib"
import { MentionPicker, matchMembers, mentionOptionId } from "./mention-picker"
import { NoteBody } from "./note-body"
import { PersonAvatar } from "./person-avatar"
import { ReactionBar } from "./reaction-bar"
import type { PrototypeNote, PrototypePost, ReactionEmoji, TeamMember } from "../types"

type NoteThreadProps = {
  post: PrototypePost
  notes: PrototypeNote[]
  team: TeamMember[]
  viewerId: string
  lastReadAt?: string
  collapsedCount?: number
  density?: "card" | "panel"
  onAdd: (body: string) => void
  onEdit: (noteId: string, body: string) => void
  onDelete: (noteId: string) => void
  onReact: (noteId: string, emoji: ReactionEmoji) => void
  onRead: () => void
  assistantAvatar: React.ReactNode
  embedded?: boolean
  initialDraft?: string
  initialEditId?: string
  initialDeleteId?: string
}

const FOCUS_OUTLINE = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"

function isSendCombo(e: React.KeyboardEvent): boolean {
  return e.key === "Enter" && (e.metaKey || e.ctrlKey)
}

function SystemLine({ note, who }: { note: PrototypeNote; who: string }): React.JSX.Element {
  const { copy } = usePrototype()
  const event = note.system?.event
  const reason = note.system?.reason ? REJECT_REASON_LABELS[note.system.reason] : (note.system?.detail ?? "")
  let icon = <CircleCheck aria-hidden className="size-4 shrink-0 text-success" />
  let text = note.body
  if (event === "approved") text = copy.notes.system.approved(who)
  else if (event === "submitted") text = copy.notes.system.submitted(who)
  else if (event === "sent_back") {
    icon = <Undo2 aria-hidden className="size-4 shrink-0 text-muted-foreground" />
    text = copy.notes.system.sentBack(who, reason)
  } else if (event === "withdrawn") {
    icon = <Undo2 aria-hidden className="size-4 shrink-0 text-muted-foreground" />
    text = copy.approve.withdrawn
  } else if (event === "edited_after_approval") {
    icon = <TriangleAlert aria-hidden className="size-4 shrink-0 text-warning" />
    text = copy.notes.system.stale(who)
  }
  return (
    <p data-figma="NoteThread/system" className="text-caption flex items-center justify-center gap-1.5 text-center text-muted-foreground">
      {icon}
      <span>{text}</span>
    </p>
  )
}

export function NoteThread({
  post,
  notes,
  team,
  viewerId,
  lastReadAt,
  collapsedCount = 3,
  density = "panel",
  onAdd,
  onEdit,
  onDelete,
  onReact,
  onRead,
  assistantAvatar,
  embedded = false,
  initialDraft = "",
  initialEditId,
  initialDeleteId,
}: NoteThreadProps): React.JSX.Element {
  const { copy, assistantName, disclosure, setDisclosure } = usePrototype()
  const { reduced } = useAgenticMotion()
  const uid = useId()
  const listId = `${uid}-list`
  const pickerId = `${uid}-mentions`
  const hintId = `${uid}-hint`
  const inputId = `${uid}-input`

  const [draft, setDraft] = useState(initialDraft)
  const [caret, setCaret] = useState(initialDraft.length)
  const [dismissedAt, setDismissedAt] = useState<number | null>(null)
  const [active, setActive] = useState<{ key: string; index: number }>({ key: "", index: 0 })
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(() => {
    const target = initialEditId ? notes.find((n) => n.id === initialEditId) : undefined
    return target ? { id: target.id, body: target.body } : null
  })
  const [deletingId, setDeletingId] = useState<string | null>(initialDeleteId ?? null)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const editRef = useRef<HTMLTextAreaElement>(null)
  const deleteCancelRef = useRef<HTMLButtonElement>(null)
  const noteRefs = useRef(new Map<string, HTMLLIElement>())
  const pendingReveal = useRef<string | null>(null)
  const pendingFocus = useRef<"edit" | "delete" | "input" | null>(null)

  const markRead = useEffectEvent(() => onRead())
  useEffect(() => {
    markRead()
  }, [])

  const sorted = [...notes].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
  const disclosureKey = `notes:${post.id}:earlier`
  const earlierOpen = disclosure[disclosureKey] ?? false
  const hiddenCount = Math.max(0, sorted.length - collapsedCount)
  const shown = earlierOpen || hiddenCount === 0 ? sorted : sorted.slice(hiddenCount)
  const readMs = lastReadAt ? Date.parse(lastReadAt) : null
  const firstUnreadId = readMs === null ? null : (sorted.find((n) => Date.parse(n.createdAt) > readMs)?.id ?? null)
  const unreadCount = readMs === null ? 0 : sorted.filter((n) => n.authorId !== viewerId && Date.parse(n.createdAt) > readMs).length
  const noteCount = sorted.filter((n) => n.kind === "note").length

  useEffect(() => {
    if (!earlierOpen || !pendingReveal.current) return
    noteRefs.current.get(pendingReveal.current)?.focus()
    pendingReveal.current = null
  }, [earlierOpen])

  useEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    pendingFocus.current = null
    if (target === "edit") editRef.current?.focus()
    else if (target === "delete") deleteCancelRef.current?.focus()
    else inputRef.current?.focus()
  }, [editing, deletingId, notes.length])

  const names = team.map((m) => m.name)
  const mention = mentionQueryAt(draft, caret, names)
  const pickerOpen = mention !== null && mention.start !== dismissedAt
  const matches = pickerOpen ? matchMembers(team, mention.query) : []
  const activeKey = mention ? `${mention.start}:${mention.query}` : ""
  const activeIndex = active.key === activeKey ? Math.min(active.index, Math.max(0, matches.length - 1)) : 0
  const activeMember = pickerOpen ? matches[activeIndex] : undefined

  const nameOf = (authorId: string): string => {
    if (authorId === viewerId) return copy.notes.you
    if (authorId === ASSISTANT_ID) return assistantName
    return team.find((m) => m.id === authorId)?.name ?? ""
  }

  const placeCaret = (pos: number) => {
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  const pick = (member: TeamMember) => {
    if (!mention) return
    const insert = `@${member.name} `
    const next = draft.slice(0, mention.start) + insert + draft.slice(caret)
    const pos = mention.start + insert.length
    setDraft(next)
    setCaret(pos)
    placeCaret(pos)
  }

  const insertAt = () => {
    const el = inputRef.current
    const at = el ? el.selectionStart : draft.length
    const needsSpace = at > 0 && !/\s/.test(draft[at - 1])
    const insert = needsSpace ? " @" : "@"
    const next = draft.slice(0, at) + insert + draft.slice(at)
    const pos = at + insert.length
    setDraft(next)
    setCaret(pos)
    setDismissedAt(null)
    placeCaret(pos)
  }

  const send = () => {
    const body = draft.trim()
    if (!body) return
    onAdd(body)
    setDraft("")
    setCaret(0)
    setDismissedAt(null)
  }

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (pickerOpen && mention) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        if (matches.length === 0) return
        const step = e.key === "ArrowDown" ? 1 : -1
        setActive({ key: activeKey, index: (activeIndex + step + matches.length) % matches.length })
        return
      }
      if ((e.key === "Enter" && !e.metaKey && !e.ctrlKey) || e.key === "Tab") {
        if (activeMember) {
          e.preventDefault()
          pick(activeMember)
        }
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setDismissedAt(mention.start)
        return
      }
    }
    if (isSendCombo(e)) {
      e.preventDefault()
      send()
    }
  }

  const syncCaret = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    setCaret(e.currentTarget.selectionStart)
  }

  const startEdit = (note: PrototypeNote) => {
    pendingFocus.current = "edit"
    setDeletingId(null)
    setEditing({ id: note.id, body: note.body })
  }

  const saveEdit = () => {
    if (!editing) return
    const body = editing.body.trim()
    if (body) onEdit(editing.id, body)
    pendingFocus.current = "input"
    setEditing(null)
  }

  const cancelEdit = () => {
    pendingFocus.current = "input"
    setEditing(null)
  }

  const confirmDelete = (noteId: string) => {
    pendingFocus.current = "input"
    setDeletingId(null)
    onDelete(noteId)
  }

  const filled = !embedded && density === "panel"
  const state = editing ? "editing" : deletingId ? "delete-confirm" : pickerOpen ? "mention" : sorted.length === 0 ? "empty" : "thread"

  return (
    <section
      aria-labelledby={`${uid}-heading`}
      data-slot="agentic-note-thread"
      data-state={state}
      data-density={density}
      data-figma="NoteThread"
      className={tw("flex min-w-0 flex-col", density === "panel" ? "gap-4" : "gap-3")}
    >
      <header data-figma="NoteThread/header" className="flex items-center gap-2">
        <MessageSquare aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <h3 id={`${uid}-heading`} className="text-title-sm text-foreground">
          {copy.notes.heading}
        </h3>
        <Badge variant="secondary" data-figma="NoteThread/count">
          {noteCount}
        </Badge>
        {unreadCount > 0 ? <span className="text-caption text-muted-foreground">{copy.notes.unread(unreadCount)}</span> : null}
      </header>

      {sorted.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">{copy.notes.empty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {hiddenCount > 0 ? (
            <DisclosureTrigger
              open={earlierOpen}
              controls={listId}
              onOpenChange={(open) => {
                pendingReveal.current = open ? (sorted[0]?.id ?? null) : null
                setDisclosure(disclosureKey, open)
              }}
              data-figma="NoteThread/earlier"
              chevronClassName="in-data-reduced-motion:transition-none"
              className="w-fit rounded-md text-muted-foreground hover:text-foreground"
            >
              <span className="text-caption">{earlierOpen ? copy.notes.hideEarlier : copy.notes.showEarlier(hiddenCount)}</span>
            </DisclosureTrigger>
          ) : null}
          <ul id={listId} aria-label={copy.notes.listLabel(post.brief ?? post.tile.headline)} className={tw("flex flex-col", density === "panel" ? "gap-5" : "gap-4")}>
            {shown.map((note) => {
              const who = nameOf(note.authorId)
              const own = note.kind === "note" && note.authorId === viewerId
              const member = team.find((m) => m.id === note.authorId)
              const isEditing = editing?.id === note.id
              const isDeleting = deletingId === note.id
              return (
                <li
                  key={note.id}
                  ref={(el) => {
                    if (el) noteRefs.current.set(note.id, el)
                    else noteRefs.current.delete(note.id)
                  }}
                  tabIndex={-1}
                  data-note-id={note.id}
                  className={tw("flex flex-col gap-3 rounded-md", FOCUS_OUTLINE)}
                >
                  {note.id === firstUnreadId ? (
                    <div data-figma="NoteThread/new" className="flex items-center gap-2">
                      <Separator className="flex-1" />
                      <Badge variant="outline">{copy.notes.newDivider}</Badge>
                      <Separator className="flex-1" />
                    </div>
                  ) : null}
                  {note.kind === "system" ? (
                    <SystemLine note={note} who={note.system ? nameOf(note.system.actorId) : who} />
                  ) : (
                    <article data-figma="NoteThread/note" className="flex gap-3">
                      <span aria-hidden className="pt-0.5">
                        {note.authorId === ASSISTANT_ID ? assistantAvatar : member ? <PersonAvatar member={member} size="sm" you={note.authorId === viewerId} /> : null}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-caption font-medium text-foreground">{who}</span>
                          <span className="text-caption text-muted-foreground">{formatRelative(note.createdAt)}</span>
                          {note.editedAt ? <span className="text-caption text-muted-foreground">{copy.notes.edited}</span> : null}
                          {own && !isEditing ? (
                            <span className="ml-auto">
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <Button variant="ghost" size="icon-sm" aria-label={copy.notes.menu} data-figma="NoteThread/menu">
                                      <Ellipsis aria-hidden />
                                    </Button>
                                  }
                                />
                                <DropdownMenuContent
                                  align="end"
                                  finalFocus={() => (pendingFocus.current ? false : true)}
                                  className={tw("w-40", reduced && REDUCED_POPUP)}
                                >
                                  <DropdownMenuItem onClick={() => startEdit(note)}>
                                    <Pencil aria-hidden />
                                    {copy.notes.edit}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      pendingFocus.current = "delete"
                                      setEditing(null)
                                      setDeletingId(note.id)
                                    }}
                                  >
                                    <Trash2 aria-hidden className="text-destructive" />
                                    {copy.notes.delete}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </span>
                          ) : null}
                        </div>
                        {isEditing && editing ? (
                          <div data-figma="NoteThread/edit" className="flex flex-col gap-2">
                            <Textarea
                              ref={editRef}
                              aria-label={copy.notes.edit}
                              value={editing.body}
                              onChange={(e) => setEditing({ id: editing.id, body: e.target.value })}
                              onKeyDown={(e) => {
                                if (isSendCombo(e)) {
                                  e.preventDefault()
                                  saveEdit()
                                } else if (e.key === "Escape") {
                                  e.preventDefault()
                                  cancelEdit()
                                }
                              }}
                              className="max-h-40"
                            />
                            <div className="flex items-center gap-2">
                              <Button size="xs" variant={filled ? "default" : "outline"} onClick={saveEdit} data-figma="NoteThread/save">
                                {copy.notes.save}
                              </Button>
                              <Button size="xs" variant="ghost" onClick={cancelEdit}>
                                {copy.notes.cancel}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <NoteBody body={note.body} annotations={note.annotations} team={team} viewerId={viewerId} />
                        )}
                        {isDeleting ? (
                          <div data-figma="NoteThread/delete-confirm" className="flex flex-wrap items-center gap-2">
                            <span className="text-body-sm text-foreground">{copy.notes.deleteConfirm}</span>
                            <Button size="xs" variant="outline" onClick={() => confirmDelete(note.id)}>
                              <Trash2 aria-hidden className="text-destructive" />
                              {copy.notes.delete}
                            </Button>
                            <Button
                              ref={deleteCancelRef}
                              size="xs"
                              variant="ghost"
                              onClick={() => {
                                pendingFocus.current = "input"
                                setDeletingId(null)
                              }}
                            >
                              {copy.notes.cancel}
                            </Button>
                          </div>
                        ) : null}
                        {!isEditing ? (
                          <ReactionBar reactions={note.reactions} viewerId={viewerId} noteId={note.id} onToggle={(emoji) => onReact(note.id, emoji)} />
                        ) : null}
                      </div>
                    </article>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div data-figma="NoteThread/reply" className="flex flex-col gap-2">
        <div className="relative">
          <label htmlFor={inputId} className="sr-only">
            {copy.notes.placeholder}
          </label>
          <Textarea
            ref={inputRef}
            id={inputId}
            role="combobox"
            aria-expanded={pickerOpen}
            aria-controls={pickerId}
            aria-autocomplete="list"
            aria-activedescendant={activeMember ? mentionOptionId(pickerId, activeMember) : undefined}
            aria-describedby={hintId}
            placeholder={copy.notes.placeholder}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setCaret(e.target.selectionStart)
            }}
            onSelect={syncCaret}
            onKeyDown={onInputKeyDown}
            className="min-h-16 max-h-40"
          />
          <MentionPicker
            query={pickerOpen && mention ? mention.query : null}
            team={team}
            activeIndex={activeIndex}
            listId={pickerId}
            onPick={pick}
            onClose={() => setDismissedAt(mention?.start ?? null)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" aria-label={copy.notes.mention} onClick={insertAt} data-figma="NoteThread/mention">
            <AtSign aria-hidden />
          </Button>
          <p id={hintId} className="text-caption min-w-0 flex-1 text-muted-foreground">
            {copy.notes.sendHint}
          </p>
          <Button
            size="sm"
            variant={filled ? "default" : "outline"}
            disabled={draft.trim().length === 0}
            onClick={send}
            data-figma="NoteThread/send"
          >
            <SendHorizontal aria-hidden />
            {copy.notes.send}
          </Button>
        </div>
      </div>
    </section>
  )
}
