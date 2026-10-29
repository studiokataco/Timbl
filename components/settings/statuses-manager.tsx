"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { arrayMove } from "@dnd-kit/sortable"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { ColumnEditDialog } from "@/components/kanban/column-edit-dialog"
import { ColumnDeleteDialog } from "@/components/kanban/column-delete-dialog"
import { ListEmpty, ListGroup, ListPanel } from "@/components/shared/list-panel"
import { Section } from "@/components/studio/section"
import { LockedNote, RowMenu, RowTag, SortableList, SortableRow } from "@/components/settings/categories-sortable"
import { reorderKanbanColumns } from "@/lib/actions/kanban-columns"
import { isProtectedStatusId } from "@/lib/schemas"
import type { WithId } from "@/lib/firebase/serialize"
import type { KanbanColumn } from "@/lib/schemas"

const postsLabel = (n: number) => (n === 0 ? "No posts" : `${n} ${n === 1 ? "post" : "posts"}`)

export function StatusesManager({
  columns,
  postCountByStatus,
}: {
  columns: WithId<KanbanColumn>[]
  postCountByStatus: Record<string, number>
}) {
  const router = useRouter()
  const [items, setItems] = useState(columns)
  const inflightRef = useRef(0)
  useEffect(() => {
    if (inflightRef.current === 0) setItems(columns)
  }, [columns])

  const [dialogState, setDialogState] = useState<
    { mode: "closed" } | { mode: "create" } | { mode: "edit"; column: WithId<KanbanColumn> }
  >({ mode: "closed" })
  const [deleteTarget, setDeleteTarget] = useState<WithId<KanbanColumn> | null>(null)
  const [pending, startTransition] = useTransition()

  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= items.length) return
    const prev = items
    const next = arrayMove(items, from, to)
    setItems(next)
    inflightRef.current++
    startTransition(async () => {
      const result = await reorderKanbanColumns({ ids: next.map((i) => i.id) })
      inflightRef.current--
      if (!result.ok) {
        setItems(prev)
        toast.error(result.error ?? "Could not reorder")
      } else {
        router.refresh()
      }
    })
  }

  const openCreate = () => setDialogState({ mode: "create" })
  const requiredCount = items.filter((c) => isProtectedStatusId(c.id)).length
  const totalPosts = items.reduce((sum, c) => sum + (postCountByStatus[c.id] ?? 0), 0)

  return (
    <Section
      id="settings-workflow-statuses"
      title="Workflow statuses"
      count={items.length}
      summary={[requiredCount > 0 && `${requiredCount} required`, postsLabel(totalPosts)].filter(Boolean).join(" · ")}
      action={
        <Button size="sm" className="h-9 px-3 sm:h-7 sm:px-2.5" disabled={pending} onClick={openCreate} aria-label="New status">
          <Plus aria-hidden />
          <span className="sm:hidden">New</span>
          <span className="hidden sm:inline">New status</span>
        </Button>
      }
    >
      <p className="mb-3 max-w-[60ch] text-[13px] text-muted-foreground">
        The steps a post moves through on the board, in order. Scheduled and Posted are required for publishing.
      </p>

      <ListPanel>
        {items.length === 0 ? (
          <ListEmpty
            title="No statuses yet"
            body="Add the steps your posts move through, from first idea to posted."
            action={
              <Button size="sm" className="h-9 sm:h-7" onClick={openCreate}>
                <Plus aria-hidden />
                New status
              </Button>
            }
          />
        ) : (
          <ListGroup>
            <SortableList
              id="statuses-manager"
              ids={items.map((i) => i.id)}
              nameOf={(id) => items.find((i) => i.id === id)?.label ?? "Status"}
              onMove={move}
            >
              {items.map((col, idx) => {
                const count = postCountByStatus[col.id] ?? 0
                const required = isProtectedStatusId(col.id)
                const lockReason = required
                  ? "Publishing depends on this status, so it can be renamed and recoloured but not deleted."
                  : items.length <= 1
                    ? "Keep at least one status on the board."
                    : null
                return (
                  <SortableRow
                    key={col.id}
                    id={col.id}
                    name={col.label}
                    color={col.color}
                    badge={required ? <RowTag>Required</RowTag> : null}
                    subtitle={
                      required ? (
                        <span className="block truncate">
                          Needed for publishing
                          <span className="md:hidden"> · {postsLabel(count)}</span>
                        </span>
                      ) : (
                        <span className="block truncate md:hidden">{postsLabel(count)}</span>
                      )
                    }
                    meta={postsLabel(count)}
                    onOpen={() => setDialogState({ mode: "edit", column: col })}
                    openLabel={`Edit ${col.label}`}
                    menu={
                      <RowMenu label={`More actions for ${col.label}`} index={idx} count={items.length} onMove={move}>
                        <DropdownMenuSeparator />
                        {lockReason ? (
                          <LockedNote>{lockReason}</LockedNote>
                        ) : (
                          <DropdownMenuItem
                            variant="destructive"
                            className="min-h-9 text-[13px] sm:min-h-8"
                            onClick={() => setDeleteTarget(col)}
                          >
                            <Trash2 aria-hidden />
                            Delete status
                          </DropdownMenuItem>
                        )}
                      </RowMenu>
                    }
                  />
                )
              })}
            </SortableList>
          </ListGroup>
        )}
      </ListPanel>

      <ColumnEditDialog
        open={dialogState.mode !== "closed"}
        onOpenChange={(v) => {
          if (!v) setDialogState({ mode: "closed" })
        }}
        mode={dialogState.mode === "edit" ? "edit" : "create"}
        column={dialogState.mode === "edit" ? dialogState.column : undefined}
        onDone={() => router.refresh()}
      />

      <ColumnDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null)
        }}
        column={deleteTarget}
        allColumns={items}
        postCount={deleteTarget ? (postCountByStatus[deleteTarget.id] ?? 0) : 0}
        onDone={() => router.refresh()}
      />
    </Section>
  )
}
