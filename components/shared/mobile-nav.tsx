"use client"

import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { SidebarContent } from "@/components/shared/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { WorkspaceSwitcherData } from "@/lib/queries/workspaces.server"
import type { BrandSwitcherData } from "@/lib/queries/brands.server"

export function MobileNav({
  workspaces,
  brands,
  user,
}: {
  workspaces: WorkspaceSwitcherData
  brands: BrandSwitcherData
  user: { name: string; email: string; role: string; avatarUrl?: string }
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
        className="max-w-full gap-0 overflow-hidden border-r border-border px-3 pb-3"
        style={{ width: "min(20rem, calc(100vw - 3rem))" }}
        showCloseButton={false}
        aria-label="Primary navigation"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Primary navigation</SheetTitle>
        </SheetHeader>
        <TooltipProvider>
          <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col">
            <SidebarContent workspaces={workspaces} brands={brands} user={user} full onNavigate={close} />
          </nav>
        </TooltipProvider>
      </SheetContent>
    </Sheet>
  )
}
