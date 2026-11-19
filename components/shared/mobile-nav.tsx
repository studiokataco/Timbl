"use client"

import { useEffect, useState } from "react"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
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

  const close = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        className="max-w-full gap-0 overflow-hidden border-r border-border p-4"
        style={{ width: "min(20rem, calc(100vw - 3rem))" }}
        showCloseButton={false}
        aria-label="Primary navigation"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Primary navigation</SheetTitle>
        </SheetHeader>
        <header className="mb-4 flex h-11 shrink-0 items-center justify-between">
          <TimblWordmark href="/calendar" logoSize={24} onClick={close} />
          <Button type="button" variant="ghost" size="icon-lg" className="size-11" aria-label="Close navigation" onClick={close}>
            <X aria-hidden className="size-5" />
          </Button>
        </header>
        <WorkspaceBrandCard workspaces={workspaces} brands={brands} className="mb-4 shrink-0" onNavigate={close} />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            close()
            window.dispatchEvent(new Event("palette:open"))
          }}
          className="mb-4 h-11 w-full justify-start gap-3 px-3 text-muted-foreground"
        >
          <Search aria-hidden className="size-5" />
          <span>Search</span>
        </Button>
        <nav aria-label="Workspace" className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav mobile onNavigate={close} />
        </nav>
        <div className="mt-3 shrink-0 border-t border-border pt-3">
          <FeedbackTrigger mobile onNavigate={close} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
