"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react"
import { toast } from "sonner"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AddBrandDialog } from "@/components/shared/add-brand-dialog"
import { setCurrentBrand } from "@/lib/actions/brands"
import type { BrandSummary, BrandSwitcherData } from "@/lib/queries/brands.server"
import { cn } from "@/lib/utils"

const AVATAR_FILLS = [
  { bg: "#ede9fe", fg: "#7c3aed" },
  { bg: "#dcfce7", fg: "#16a34a" },
  { bg: "#ffedd5", fg: "#ea580c" },
  { bg: "#fce7f3", fg: "#db2777" },
] as const

function fillFor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return AVATAR_FILLS[Math.abs(hash) % AVATAR_FILLS.length]
}

function BrandAvatar({ name, className }: { name: string; className?: string }) {
  const fill = fillFor(name)
  const initial = name.trim().charAt(0).toUpperCase() || "?"
  return (
    <span
      aria-hidden
      style={{ backgroundColor: fill.bg, color: fill.fg }}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
        className,
      )}
    >
      {initial}
    </span>
  )
}

export function BrandSwitcher({
  data,
  className,
}: {
  data: BrandSwitcherData
  className?: string
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const { current, brands, atCap } = data

  /* Point every brand-scoped surface (calendar, kanban, list) at the new brand:
   * switch the cookie, drop the "posts" query family, re-render server data. */
  function activate(brandId: string) {
    startTransition(async () => {
      try {
        const res = await setCurrentBrand(brandId)
        if (!res.ok) throw new Error(res.error ?? "Could not switch brand")
        await queryClient.invalidateQueries({ queryKey: ["posts"] })
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not switch brand")
      } finally {
        setBusyId(null)
      }
    })
  }

  function switchTo(brand: BrandSummary) {
    if (brand.id === current.id) return
    setBusyId(brand.id)
    activate(brand.id)
  }

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-xl border border-border bg-background px-2.5 py-2 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-secondary/60",
          className,
        )}
        aria-label={`Current brand: ${current.name}. Switch brand`}
      >
        <BrandAvatar name={current.name} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-caption uppercase tracking-wider text-muted-foreground">
            Brand
          </span>
          <span className="truncate text-sm font-semibold leading-tight text-foreground">
            {current.name}
          </span>
        </span>
        <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={6} className="min-w-64 max-w-80">
        <DropdownMenuLabel className="text-caption uppercase tracking-wider text-muted-foreground">
          Brands
        </DropdownMenuLabel>
        <div className="max-h-72 overflow-y-auto">
          {brands.map((brand) => (
            <DropdownMenuItem
              key={brand.id}
              disabled={pending}
              closeOnClick={false}
              onClick={() => switchTo(brand)}
              className={cn("gap-2.5 py-2", brand.id === current.id && "bg-secondary/50")}
            >
              <BrandAvatar name={brand.name} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium leading-tight">
                {brand.name}
              </span>
              {busyId === brand.id ? (
                <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-muted-foreground" />
              ) : brand.id === current.id ? (
                <Check aria-hidden className="size-4 shrink-0 text-foreground" />
              ) : null}
            </DropdownMenuItem>
          ))}
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setAddOpen(true)}
          disabled={pending || atCap}
          className="gap-2.5 py-2"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
            <Plus aria-hidden className="size-4" />
          </span>
          <span className="text-sm font-medium">
            {atCap ? "Brand limit reached - upgrade to add more" : "Add brand"}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <AddBrandDialog open={addOpen} onOpenChange={setAddOpen} onCreated={activate} />
    </>
  )
}
