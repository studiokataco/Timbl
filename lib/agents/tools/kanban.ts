import { z } from "zod"
import { FunctionTool } from "@google/adk"

import { getAdminDb } from "@/lib/firebase/admin"
import {
  orgKanbanColumnsPath,
  orgPostsPath,
} from "@/lib/firebase/paths"

import { getRuntimeCtx } from "../runtime/context"

export const listKanbanColumnsTool = new FunctionTool({
  name: "listColumns",
  description:
    "List the kanban columns for the org in display order. Use these ids when calling moveCard / movePostToColumn.",
  parameters: z.object({}),
  execute: async (_input, ctx) => {
    const { orgId } = getRuntimeCtx(ctx)
    const snap = await getAdminDb()
      .collection(orgKanbanColumnsPath(orgId))
      .orderBy("sortOrder", "asc")
      .get()
    return {
      columns: snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          label: data.label,
          color: data.color,
          sortOrder: data.sortOrder,
          isSystemDefault: !!data.isSystemDefault,
        }
      }),
    }
  },
})

const moveInput = z.object({
  postId: z.string().min(1),
  toColumnId: z.string().min(1),
})

export const moveKanbanCardTool = new FunctionTool({
  name: "moveCard",
  description:
    "Alias of movePostToColumn - present for agents that think in kanban terms rather than posts.",
  parameters: moveInput,
  execute: async (input, ctx) => {
    const { orgId } = getRuntimeCtx(ctx)
    const db = getAdminDb()
    const columnRef = db
      .collection(orgKanbanColumnsPath(orgId))
      .doc(input.toColumnId)
    const colSnap = await columnRef.get()
    if (!colSnap.exists) return { ok: false, error: "column_not_found" }
    const postRef = db.collection(orgPostsPath(orgId)).doc(input.postId)
    const postSnap = await postRef.get()
    if (!postSnap.exists) return { ok: false, error: "post_not_found" }
    if (postSnap.data()?.organizationId !== orgId) {
      return { ok: false, error: "cross_org" }
    }
    await postRef.set(
      { status: input.toColumnId, updatedAt: new Date().toISOString() },
      { merge: true },
    )
    return { ok: true }
  },
})
