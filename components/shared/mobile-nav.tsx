"use client"

import { useEffect, useState } from "react"
import { Search } from "lucide-react"

import { Sheet, SheetContent } from "@/components/ui/sheet"
import { TimblWordmark } from "@/components/brand/timbl-logo"
import { SidebarNav, FeedbackTrigger, WorkspaceBrandCard } from "@/components/shared/sidebar"
import type { WorkspaceSwitcherData } from "@/lib/queries/workspaces.server"
import type { BrandSwitcherData } from "@/lib/queries/brands.server"

export function MobileNav({
  workspaces,
  brands,
}: {
  workspaces: WorkspaceSwitcherData
  brands: BrandSwitcherData
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener("nav:open", onOpen)
    return () => window.removeEventListener("nav:open", onOpen)
  }, [])
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        className="w-72 max-w-[80vw] p-3 gap-1"
        aria-label="Primary navigation"
      >
        <TimblWordmark href="/calendar" logoSize={24} className="px-3 mb-4 mt-1" />
        <WorkspaceBrandCard workspaces={workspaces} brands={brands} className="mb-3" />
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            window.dispatchEvent(new Event("palette:open"))
          }}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground mb-1"
        >
          <Search aria-hidden className="size-4" />
          <span>Search</span>
        </button>
        <nav className="flex flex-col gap-1">
          <SidebarNav onNavigate={() => setOpen(false)} />
          <FeedbackTrigger onNavigate={() => setOpen(false)} className="mt-1" />
        </nav>
      </SheetContent>
    </Sheet>
  )
}
