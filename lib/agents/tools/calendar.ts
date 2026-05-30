import { z } from "zod"
import { FunctionTool } from "@google/adk"

import { getAdminDb } from "@/lib/firebase/admin"
import {
  orgEventsPath,
  orgPostsPath,
} from "@/lib/firebase/paths"
import { isoDate, isoTime } from "@/lib/schemas/_shared"

import { getRuntimeCtx } from "../runtime/context"

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const
const weekday = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])

const listEventsInput = z.object({
  fromDate: isoDate,
  toDate: isoDate,
  limit: z.number().int().min(1).max(200).default(50),
})

export const listEventsTool = new FunctionTool({
  name: "listEvents",
  description:
    "List off-calendar events (conferences, campaigns, awareness days) that fall in the [fromDate, toDate] window. Useful for cadence planning to avoid double-booking.",
  parameters: listEventsInput,
  execute: async (input, ctx) => {
    const { orgId } = getRuntimeCtx(ctx)
    const snap = await getAdminDb()
      .collection(orgEventsPath(orgId))
      .where("startDate", ">=", input.fromDate)
      .where("startDate", "<=", input.toDate)
      .orderBy("startDate", "asc")
      .limit(input.limit)
      .get()
    return {
      events: snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          name: data.name,
          startDate: data.startDate,
          endDate: data.endDate ?? null,
          location: data.location ?? null,
        }
      }),
    }
  },
})

const findSlotsInput = z.object({
  fromDate: isoDate,
  toDate: isoDate,
  perWeek: z.number().int().min(1).max(14),
  preferredDays: z.array(weekday).default([]),
  preferredTimes: z.array(isoTime).default([]),
  excludeAlreadyScheduled: z.boolean().default(true),
})

/*
 * Mechanically pick candidate slots that honour the brand's cadence
 * preferences. The cadence-planner reads these and then asks the LLM to
 * fill each slot - deterministic slot-finding keeps the LLM focused on
 * creative work instead of date arithmetic, which it's bad at.
 */
export const findOpenSlotsTool = new FunctionTool({
  name: "findOpenSlots",
  description:
    "Compute candidate posting slots in the window [fromDate, toDate]. Honours `perWeek` and the brand's preferred days/times. Returns an array of {date, time} where time may be null if no preferred times were given. The LLM should pick from these slots; it should not invent its own dates.",
  parameters: findSlotsInput,
  execute: async (input, ctx) => {
    const { orgId } = getRuntimeCtx(ctx)
    const from = new Date(`${input.fromDate}T00:00:00Z`)
    const to = new Date(`${input.toDate}T00:00:00Z`)
    if (Number.isNaN(from.valueOf()) || Number.isNaN(to.valueOf())) {
      return { ok: false, error: "invalid_date_range" }
    }

    const taken = new Set<string>()
    if (input.excludeAlreadyScheduled) {
      const snap = await getAdminDb()
        .collection(orgPostsPath(orgId))
        .where("scheduledDate", ">=", input.fromDate)
        .where("scheduledDate", "<=", input.toDate)
        .get()
      for (const d of snap.docs) taken.add(d.data().scheduledDate as string)
    }

    const preferredDays = new Set(input.preferredDays)
    const times = input.preferredTimes.length
      ? input.preferredTimes
      : [null]

    const slots: { date: string; time: string | null }[] = []
    // Iterate week by week so perWeek is enforced over rolling weeks.
    const cursor = new Date(from.valueOf())
    while (cursor <= to) {
      const weekEnd = new Date(cursor.valueOf())
      weekEnd.setUTCDate(cursor.getUTCDate() + 6)
      let placed = 0
      const dayCursor = new Date(cursor.valueOf())
      while (dayCursor <= weekEnd && dayCursor <= to && placed < input.perWeek) {
        const dow = WEEKDAYS[dayCursor.getUTCDay()]
        const date = dayCursor.toISOString().slice(0, 10)
        const dayAllowed =
          preferredDays.size === 0 || preferredDays.has(dow as never)
        if (dayAllowed && !taken.has(date)) {
          for (const t of times) {
            slots.push({ date, time: t })
            placed += 1
            if (placed >= input.perWeek) break
          }
          taken.add(date)
        }
        dayCursor.setUTCDate(dayCursor.getUTCDate() + 1)
      }
      cursor.setUTCDate(cursor.getUTCDate() + 7)
    }
    return { slots }
  },
})

const scheduleDraftInput = z.object({
  postId: z.string().min(1),
  scheduledDate: isoDate,
  scheduledTime: isoTime.optional(),
})

export const scheduleDraftTool = new FunctionTool({
  name: "scheduleDraft",
  description:
    "Set the scheduledDate / scheduledTime on an existing post. Use this in the scheduler stage of the pipeline to lock a slot.",
  parameters: scheduleDraftInput,
  execute: async (input, ctx) => {
    const { orgId } = getRuntimeCtx(ctx)
    const ref = getAdminDb()
      .collection(orgPostsPath(orgId))
      .doc(input.postId)
    const snap = await ref.get()
    if (!snap.exists) return { ok: false, error: "post_not_found" }
    if (snap.data()?.organizationId !== orgId) {
      return { ok: false, error: "cross_org" }
    }
    await ref.set(
      {
        scheduledDate: input.scheduledDate,
        scheduledTime: input.scheduledTime,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    )
    return { ok: true }
  },
})
