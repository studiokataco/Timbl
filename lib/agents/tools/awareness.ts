import { z } from "zod"
import { FunctionTool } from "@google/adk"

import { getAdminDb } from "@/lib/firebase/admin"
import { awarenessDaysPath } from "@/lib/firebase/paths"
import { isoDate } from "@/lib/schemas/_shared"

import { getRuntimeCtx } from "../runtime/context"

/* Awareness days live in a global (non-org-scoped) collection - they're
 * a shared registry, not tenant data. Tools still read RuntimeCtx so the
 * permissions layer can audit which agent is touching them. */

const listInput = z.object({
  fromDate: isoDate,
  toDate: isoDate,
  importance: z.enum(["low", "medium", "high"]).optional(),
  limit: z.number().int().min(1).max(200).default(50),
})

export const listUpcomingAwarenessDaysTool = new FunctionTool({
  name: "listUpcomingDays",
  description:
    "List awareness days in the [fromDate, toDate] window. Use these as a starting point for ideation. The returned `id` is what you pass to promoteAwarenessDay (when wired in Phase 6).",
  parameters: listInput,
  execute: async (input, ctx) => {
    getRuntimeCtx(ctx)
    let q: FirebaseFirestore.Query = getAdminDb()
      .collection(awarenessDaysPath)
      .where("date", ">=", input.fromDate)
      .where("date", "<=", input.toDate)
    if (input.importance) q = q.where("importance", "==", input.importance)
    q = q.orderBy("date", "asc").limit(input.limit)
    const snap = await q.get()
    return {
      days: snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          date: data.date,
          name: data.name,
          description: data.description ?? null,
          importance: data.importance ?? "medium",
        }
      }),
    }
  },
})
