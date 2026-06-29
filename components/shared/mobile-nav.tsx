"use client"

import { useState } from "react"
import { Menu, Search } from "lucide-react"

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { TimblWordmark } from "@/components/brand/timbl-logo"
import { SidebarNav } from "@/components/shared/sidebar"
import { WorkspaceSwitcher } from "@/components/shared/workspace-switcher"
import type { WorkspaceSwitcherData } from "@/lib/queries/workspaces.server"

export function MobileNav({ workspaces }: { workspaces: WorkspaceSwitcherData }) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            aria-label="Open navigation"
            className="md:hidden inline-flex items-center justify-center size-9 -ml-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
          />
        }
      >
        <Menu aria-hidden className="size-5" />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 max-w-[80vw] p-3 gap-1"
        aria-label="Primary navigation"
      >
        <TimblWordmark href="/calendar" logoSize={24} className="px-3 mb-4 mt-1" />
        <WorkspaceSwitcher data={workspaces} className="mb-3" />
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
        </nav>
      </SheetContent>
    </Sheet>
  )
}
