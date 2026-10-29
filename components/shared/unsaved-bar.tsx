"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"

export function UnsavedBar({
  show,
  saving,
  onDiscard,
  label = "Unsaved changes",
}: {
  show: boolean
  saving: boolean
  onDiscard: () => void
  label?: string
}) {
  const reduced = useReducedMotion()
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="sticky bottom-[var(--ask-ai-clearance)] z-20 mt-6 flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 shadow-[0_2px_6px_rgb(0_0_0/0.08)]"
        >
          <span className="text-[13px] text-muted-foreground">{label}</span>
          <span className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>
              Discard
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              Save changes
            </Button>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
