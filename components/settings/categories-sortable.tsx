"use client"

import type { ReactNode } from "react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useReducedMotion } from "framer-motion"
import { ArrowDown, ArrowUp, Check, GripVertical, Lock, MoreHorizontal } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const lockToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 })

export function SortableList({
  id,
  ids,
  nameOf,
  onMove,
  children,
}: {
  id: string
  ids: string[]
  nameOf: (id: UniqueIdentifier) => string
  onMove: (from: number, to: number) => void
  children: ReactNode
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} is over ${nameOf(over.id)}.` : `${nameOf(active.id)} is outside the list.`,
    onDragEnd: ({ active, over }) =>
      over ? `${nameOf(active.id)} moved to ${nameOf(over.id)}'s place.` : `${nameOf(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Stopped moving ${nameOf(active.id)}.`,
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    onMove(from, to)
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[lockToVerticalAxis]}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: "Press space or enter to pick up. Use the arrow keys to move, space or enter to drop, escape to cancel.",
        },
      }}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

export function SortableRow({
  id,
  name,
  color,
  badge,
  subtitle,
  meta,
  menu,
  onOpen,
  openLabel,
  sortable = true,
  checked,
  disabled,
}: {
  id: string
  name: string
  color: string
  badge?: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  menu?: ReactNode
  onOpen: () => void
  openLabel: string
  sortable?: boolean
  checked?: boolean
  disabled?: boolean
}) {
  const selecting = checked !== undefined
  const reduced = useReducedMotion()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !sortable, transition: reduced ? null : undefined })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group relative isolate flex min-h-14 items-center gap-2 bg-background px-2 py-2 transition-colors duration-150 ease-out sm:gap-3 sm:px-3",
        !disabled && "hover:bg-secondary/40 has-[[data-row]:focus-visible]:bg-secondary/40",
        checked && "bg-secondary/60 hover:bg-secondary/60",
        isDragging && "z-10 bg-background shadow-md motion-reduce:shadow-sm",
      )}
    >
      <button
        data-row
        type="button"
        onClick={onOpen}
        disabled={disabled}
        aria-label={openLabel}
        {...(selecting ? { role: "checkbox", "aria-checked": checked } : {})}
        className="absolute inset-0 focus-visible:outline-none disabled:cursor-not-allowed"
      />

      {selecting ? (
        <span aria-hidden className="grid size-9 shrink-0 place-items-center sm:w-7">
          <span
            className={cn(
              "grid size-4 place-items-center rounded-[4px] border border-input transition-colors duration-150",
              checked && "border-primary bg-primary text-primary-foreground",
              disabled && "opacity-40",
            )}
          >
            {checked ? <Check className="size-3" strokeWidth={3} /> : null}
          </span>
        </span>
      ) : (
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label={`Reorder ${name}`}
          className="relative z-10 grid size-9 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing sm:w-7"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      )}

      <span
        aria-hidden
        className="pointer-events-none size-2.5 shrink-0 rounded-full ring-1 ring-inset ring-foreground/10"
        style={{ backgroundColor: color }}
      />

      <div className={cn("pointer-events-none min-w-0 flex-1 pl-1", disabled && "opacity-60")}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[14px] font-medium text-foreground">{name}</span>
          {badge}
        </div>
        {subtitle != null && <div className="text-[13px] text-muted-foreground">{subtitle}</div>}
      </div>

      {meta != null && (
        <div className="pointer-events-none hidden shrink-0 text-right text-[12px] tabular-nums text-muted-foreground @2xl:block">
          {meta}
        </div>
      )}

      {menu != null && !selecting && <div className="relative z-10 shrink-0">{menu}</div>}
    </li>
  )
}

export function RowTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[12px] font-medium text-muted-foreground">
      <Lock className="size-3" aria-hidden />
      {children}
    </span>
  )
}

export function RowMenu({
  label,
  index,
  count,
  onMove,
  children,
}: {
  label: string
  index: number
  count: number
  onMove: (from: number, to: number) => void
  children: ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={label}
            className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-secondary data-[popup-open]:text-foreground sm:size-8"
          />
        }
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem disabled={index === 0} onClick={() => onMove(index, index - 1)} className="min-h-9 text-[13px] sm:min-h-8">
          <ArrowUp aria-hidden />
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={index === count - 1}
          onClick={() => onMove(index, index + 1)}
          className="min-h-9 text-[13px] sm:min-h-8"
        >
          <ArrowDown aria-hidden />
          Move down
        </DropdownMenuItem>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function LockedNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 px-1.5 py-1.5 text-[12px] leading-snug text-muted-foreground">
      <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
      {children}
    </p>
  )
}
