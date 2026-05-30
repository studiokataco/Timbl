"use client"

import { useTransition } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { RefreshCw, Sparkles, X } from "lucide-react"
import { toast } from "sonner"

import {
  listModelUpdates,
  runModelUpdateCheckNow,
  dismissModelUpdate,
  getNotifyModelUpdates,
  setNotifyModelUpdates,
} from "@/lib/actions/model-updates"
import { PROVIDER_TONE } from "./status-tone"
import { cn } from "@/lib/utils"

/*
 * Model-updates card (§6.8) - notify-only. Lists provider models the
 * bi-weekly / manual check flagged as plausible newer versions of models
 * in use. Nothing here applies a model: the operator reviews a flagged
 * model, then swaps it on an agent in the Tune tab and prod-swap A/Bs.
 *
 * Mounted in the Studio roster rail. Renders nothing when there are no
 * notifications and the toggle is on - stays out of the way until useful.
 */
export function ModelUpdatesCard() {
  const queryClient = useQueryClient()
  const [pending, startTransition] = useTransition()

  const updates = useQuery({
    queryKey: ["model-updates"],
    queryFn: listModelUpdates,
    staleTime: 60_000,
  })
  const notify = useQuery({
    queryKey: ["model-updates", "notify"],
    queryFn: getNotifyModelUpdates,
    staleTime: 60_000,
  })

  const items = updates.data ?? []
  const notifyOn = notify.data ?? true

  /* The card always renders: the "check now" button and the notify
   * toggle must stay reachable even when there are no notifications -
   * otherwise the operator could never run the first check. The empty
   * state is just terse copy. */

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["model-updates"] })

  const checkNow = () =>
    startTransition(async () => {
      const res = await runModelUpdateCheckNow()
      if (!res.ok) {
        toast.error("Check failed", { description: res.error })
        return
      }
      if (res.checked === false) {
        toast.message("Notifications are off - nothing checked")
      } else {
        toast.success(
          res.flagged
            ? `${res.flagged} new model${res.flagged === 1 ? "" : "s"} flagged`
            : "No new models",
        )
      }
      invalidate()
    })

  const dismiss = (id: string) =>
    startTransition(async () => {
      const res = await dismissModelUpdate(id)
      if (res.ok) invalidate()
      else toast.error("Could not dismiss", { description: res.error })
    })

  const toggleNotify = () =>
    startTransition(async () => {
      const res = await setNotifyModelUpdates(!notifyOn)
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["model-updates", "notify"] })
      } else {
        toast.error("Could not update setting", { description: res.error })
      }
    })

  return (
    <div className="rounded-md border border-border bg-canvas p-3 flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Sparkles className="size-3.5 text-foreground/70" aria-hidden />
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground flex-1">
          Model updates
        </span>
        <button
          type="button"
          onClick={checkNow}
          disabled={pending}
          className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          aria-label="Check for model updates now"
        >
          <RefreshCw
            className={cn("size-3.5", pending && "animate-spin")}
            aria-hidden
          />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-[12px] text-muted-foreground leading-snug">
          {notifyOn
            ? "No new models flagged."
            : "Update notifications are off - agents stay pinned."}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-2 rounded-md bg-secondary/50 px-2 py-1.5"
            >
              <span
                className={cn(
                  "text-[10px] uppercase tracking-wide rounded-pill px-1.5 py-0.5 shrink-0",
                  PROVIDER_TONE[u.provider] ??
                    "bg-secondary text-muted-foreground",
                )}
              >
                {u.provider}
              </span>
              <span className="flex-1 min-w-0 text-[12px] font-mono text-foreground truncate">
                {u.modelId}
              </span>
              <button
                type="button"
                onClick={() => dismiss(u.id)}
                disabled={pending}
                className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                aria-label={`Dismiss ${u.modelId}`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={toggleNotify}
        disabled={pending}
        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors text-left disabled:opacity-50"
      >
        Notifications: {notifyOn ? "on" : "off"} - tap to turn{" "}
        {notifyOn ? "off" : "on"}
      </button>
    </div>
  )
}
