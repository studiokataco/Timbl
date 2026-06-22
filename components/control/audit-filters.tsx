"use client"

import { useId, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowDown, ArrowUp, Check, ChevronsUpDown, X } from "lucide-react"

import { ACTION_LABEL } from "@/components/control/audit-table"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { platformAuditAction, type PlatformAuditAction } from "@/lib/platform/schema"
import { cn } from "@/lib/utils"

type OrgOption = { id: string; name: string }

const ALL = "__all__"

export function AuditFilters({
  action,
  org,
  actor,
  after,
  before,
  sort,
  orgOptions,
  actorSuggestions,
}: {
  action?: PlatformAuditAction
  org?: string
  actor?: string
  after?: string
  before?: string
  sort: "asc" | "desc"
  orgOptions: OrgOption[]
  actorSuggestions: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [orgOpen, setOrgOpen] = useState(false)
  const actorListId = useId()

  const setParams = (updates: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) sp.set(key, value)
      else sp.delete(key)
    }
    sp.delete("cursor")
    const qs = sp.toString()
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname))
  }

  const selectedOrg = org ? (orgOptions.find((o) => o.id === org)?.name ?? org) : null
  const hasFilters = Boolean(action || org || actor || after || before)

  return (
    <div
      className={cn(
        "mb-5 flex flex-wrap items-end gap-3 rounded-xl p-3 ring-1 ring-foreground/10 transition-opacity",
        pending && "opacity-60",
      )}
    >
      <Field label="Action">
        <Select
          value={action ?? ALL}
          onValueChange={(v) => setParams({ action: v && v !== ALL ? v : undefined })}
        >
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue>
              {(v) =>
                !v || v === ALL
                  ? "All actions"
                  : (ACTION_LABEL[v as PlatformAuditAction] ?? v)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All actions</SelectItem>
            {platformAuditAction.options.map((a) => (
              <SelectItem key={a} value={a}>
                {ACTION_LABEL[a]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Workspace">
        <Popover open={orgOpen} onOpenChange={setOrgOpen}>
          <PopoverTrigger
            render={
              <Button variant="outline" className="h-9 w-56 justify-between font-normal" />
            }
          >
            <span className="truncate">
              {selectedOrg ?? <span className="text-muted-foreground">All workspaces</span>}
            </span>
            <ChevronsUpDown aria-hidden className="size-4 shrink-0 opacity-50" />
          </PopoverTrigger>
          <PopoverContent className="w-[min(18rem,calc(100vw-2rem))] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search workspaces..." />
              <CommandList>
                <CommandEmpty>No workspaces.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="all workspaces"
                    onSelect={() => {
                      setOrgOpen(false)
                      setParams({ org: undefined })
                    }}
                  >
                    <Check className={cn("size-4", org ? "opacity-0" : "opacity-100")} />
                    All workspaces
                  </CommandItem>
                  {orgOptions.map((o) => (
                    <CommandItem
                      key={o.id}
                      value={`${o.name} ${o.id}`}
                      onSelect={() => {
                        setOrgOpen(false)
                        setParams({ org: o.id })
                      }}
                    >
                      <Check
                        className={cn("size-4", org === o.id ? "opacity-100" : "opacity-0")}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{o.name}</span>
                        <span className="truncate font-mono text-[11px] text-muted-foreground">
                          {o.id}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </Field>

      <Field label="Admin">
        <Input
          className="h-9 w-52"
          type="email"
          inputMode="email"
          placeholder="admin@email"
          list={actorListId}
          defaultValue={actor ?? ""}
          onBlur={(e) => {
            const next = e.target.value.trim() || undefined
            if (next !== actor) setParams({ actor: next })
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur()
          }}
        />
        <datalist id={actorListId}>
          {actorSuggestions.map((email) => (
            <option key={email} value={email} />
          ))}
        </datalist>
      </Field>

      <Field label="From">
        <Input
          className="h-9 w-40"
          type="date"
          value={after ?? ""}
          max={before || undefined}
          onChange={(e) => setParams({ after: e.target.value || undefined })}
        />
      </Field>

      <Field label="To">
        <Input
          className="h-9 w-40"
          type="date"
          value={before ?? ""}
          min={after || undefined}
          onChange={(e) => setParams({ before: e.target.value || undefined })}
        />
      </Field>

      <Button
        variant="outline"
        className="h-9"
        onClick={() => setParams({ sort: sort === "desc" ? "asc" : undefined })}
      >
        {sort === "desc" ? (
          <ArrowDown aria-hidden className="size-4" />
        ) : (
          <ArrowUp aria-hidden className="size-4" />
        )}
        {sort === "desc" ? "Newest first" : "Oldest first"}
      </Button>

      {hasFilters ? (
        <Button
          variant="ghost"
          className="h-9 text-muted-foreground"
          onClick={() =>
            setParams({
              action: undefined,
              org: undefined,
              actor: undefined,
              after: undefined,
              before: undefined,
            })
          }
        >
          <X aria-hidden className="size-4" />
          Clear
        </Button>
      ) : null}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}
