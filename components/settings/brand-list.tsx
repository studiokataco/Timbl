"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, Plus } from "lucide-react"

import { AddBrandDialog } from "@/components/shared/add-brand-dialog"
import { ChannelGlyph } from "@/components/shared/channel-glyph"
import { IdentityAvatar } from "@/components/shared/identity-avatar"
import { Button } from "@/components/ui/button"
import { SettingsPage } from "@/components/settings/settings-page"
import { brandTagline, cadenceLabel, hasStarterName } from "@/components/settings/brand-meta"
import type { BrandSummary, BrandSwitcherData } from "@/lib/queries/brands.server"
import { cn } from "@/lib/utils"

export function BrandList({ data, canEdit }: { data: BrandSwitcherData; canEdit: boolean }) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const count = data.brands.length

  const addButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setAddOpen(true)}
      disabled={!canEdit || data.atCap}
    >
      <Plus aria-hidden />
      Add brand
    </Button>
  )

  return (
    <SettingsPage
      title="Brands"
      description={`${count} ${count === 1 ? "brand" : "brands"} · ${data.current.name} is active. Each keeps its own voice, channels, posts and agent memory.`}
      action={addButton}
    >
      <ul className="@container divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
        {data.brands.map((brand) => (
          <BrandRow key={brand.id} brand={brand} active={brand.id === data.current.id} />
        ))}
      </ul>
      {data.atCap ? (
        <p className="mt-3 text-[13px] text-muted-foreground">
          {"You've reached your plan's brand limit. "}
          <Link href="/settings/billing" className="font-medium text-foreground underline underline-offset-2">
            Compare plans
          </Link>
        </p>
      ) : null}

      <AddBrandDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(id) => router.push(`/settings/brands/${id}`)}
      />
    </SettingsPage>
  )
}

function BrandRow({ brand, active }: { brand: BrandSummary; active: boolean }) {
  return (
    <li className="group relative isolate flex items-center gap-3 px-3 py-3 transition-colors hover:bg-secondary/40 has-[a:focus-visible]:bg-secondary/40 sm:px-4">
      <Link
        href={`/settings/brands/${brand.id}`}
        aria-label={`Open ${brand.name}`}
        className="absolute inset-0 focus-visible:outline-none"
      />
      <IdentityAvatar name={brand.name} src={brand.avatarUrl} color={brand.color} className="size-9" />
      <div className="pointer-events-none min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-foreground">{brand.name}</span>
          {hasStarterName(brand) ? (
            <span className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              Needs a name
            </span>
          ) : null}
          {active ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
              <span aria-hidden className="size-2 rounded-full bg-emerald-500" />
              Active
            </span>
          ) : null}
        </div>
        <p className={cn("truncate text-[13px]", brand.voice ? "text-muted-foreground" : "text-muted-foreground/80")}>
          {brandTagline(brand)}
        </p>
      </div>
      <div className="pointer-events-none hidden w-44 shrink-0 flex-col gap-1 text-[12px] text-muted-foreground @2xl:flex">
        <span className="flex items-center gap-1">
          {brand.channels.length ? (
            brand.channels.slice(0, 6).map((ch) => <ChannelGlyph key={ch} channel={ch} className="size-3.5" />)
          ) : (
            <span>No channels yet</span>
          )}
        </span>
        <span>{cadenceLabel(brand)}</span>
      </div>
      <ChevronRight
        aria-hidden
        className="pointer-events-none size-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 group-hover:translate-x-0.5"
      />
    </li>
  )
}
