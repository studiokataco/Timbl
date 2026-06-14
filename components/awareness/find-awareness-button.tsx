"use client"

import { useState } from "react"
import { Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { AwarenessResearchDialog } from "./awareness-research-dialog"

/*
 * Client-only trigger for the awareness-researcher. Lives in the
 * PageHeader action slot on /awareness.
 */
export function FindAwarenessButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)} className="w-full sm:w-auto">
        <Sparkles aria-hidden className="size-4" />
        <span className="sm:hidden">Find days</span>
        <span className="hidden sm:inline">Find new awareness days</span>
      </Button>
      <AwarenessResearchDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
