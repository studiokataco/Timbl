"use client"

import { useCallback, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { approveItem, bulkApproveItems, listApprovalsLog, revertApproval } from "@/lib/actions/approvals"
import { saveAssistantThread } from "@/lib/actions/assistant-threads"
import { SHELL_THREAD_ID } from "@/lib/constants/timbl"
import { addComment, deleteComment, editComment, toggleCommentReaction } from "@/lib/actions/post-comments"
import { deletePost, updatePost } from "@/lib/actions/posts"
import { markPostRead } from "@/lib/actions/presence"
import type { ServerActionResult } from "@/lib/schemas"
import { localKey, nowMs } from "../clock"
import type { EngineEvent, PersistOp } from "../types"

const POST_OPS = new Set<PersistOp["kind"]>(["approve", "unapprove", "status", "move", "caption", "publish", "bulk_approve", "delete"])

export function usePersist(onError: (message: string) => void) {
  const qc = useQueryClient()
  const logs = useRef(new Map<string, string>())
  const inflight = useRef(new Set<string>())

  return useCallback(
    async (op: PersistOp, dispatch: (event: EngineEvent) => void) => {
      const key = op.kind === "approve" || op.kind === "unapprove" ? `approval:${op.postId}` : op.kind === "delete" ? `delete:${op.postId}` : ""
      if (key && inflight.current.has(key)) return
      if (op.kind === "approve" && logs.current.has(op.postId)) return
      if (key) inflight.current.add(key)
      let result: ServerActionResult = { ok: true }
      try {
        switch (op.kind) {
          case "approve": {
            const res = await approveItem({ itemType: "post", itemId: op.postId })
            if (res.ok && res.approvalLogId) logs.current.set(op.postId, res.approvalLogId)
            result = res
            break
          }
          case "unapprove": {
            let logId = logs.current.get(op.postId)
            if (!logId) {
              const rows = await listApprovalsLog({ limit: 50 })
              logId = rows.find((row) => row.itemId === op.postId && !row.revertedAt)?.id
            }
            if (logId) {
              logs.current.delete(op.postId)
              result = await revertApproval({ approvalLogId: logId })
            }
            break
          }
          case "bulk_approve": {
            const res = await bulkApproveItems({
              items: op.postIds.map((itemId) => ({ itemType: "post" as const, itemId })),
            })
            op.postIds.forEach((postId, index) => {
              const id = res.approvalLogIds[index]
              if (id) logs.current.set(postId, id)
            })
            result = res.ok ? res : { ok: false, error: res.error ?? `${res.failed} failed` }
            break
          }
          case "deck_skips":
            result = await saveAssistantThread({ id: SHELL_THREAD_ID, skippedPostIds: op.postIds })
            break
          case "status":
            result = await updatePost({ id: op.postId, status: op.status })
            break
          case "move":
            result = await updatePost({ id: op.postId, scheduledDate: op.date, scheduledTime: op.time ?? null })
            break
          case "caption":
            result = await updatePost({ id: op.postId, blurb: op.blurb })
            break
          case "publish": {
            const [date, time] = localKey(nowMs()).split(" ")
            result = await updatePost({ id: op.postId, status: "scheduled", scheduledDate: date, scheduledTime: time })
            break
          }
          case "delete":
            result = await deletePost(op.postId)
            break
          case "note_add": {
            const res = await addComment({ postId: op.postId, body: op.body, mentions: op.mentions, isInternal: true })
            if (res.ok && res.id && op.localId) dispatch({ type: "note_saved", localId: op.localId, id: res.id })
            result = res
            break
          }
          case "note_edit":
            result = await editComment({ postId: op.postId, commentId: op.noteId, body: op.body, mentions: op.mentions })
            break
          case "note_delete":
            result = await deleteComment({ postId: op.postId, commentId: op.noteId })
            break
          case "note_react":
            result = await toggleCommentReaction({ postId: op.postId, commentId: op.noteId, emoji: op.emoji })
            break
          case "read":
            result = await markPostRead(op.postId)
            break
        }
      } catch (err) {
        result = { ok: false, error: err instanceof Error ? err.message : String(err) }
      } finally {
        if (key) inflight.current.delete(key)
      }
      if (!result.ok && result.error) onError(result.error)
      if (POST_OPS.has(op.kind)) void qc.invalidateQueries({ queryKey: ["posts"] })
      if (op.kind.startsWith("note_") || op.kind === "read") void qc.invalidateQueries({ queryKey: ["post-notes"] })
    },
    [onError, qc],
  )
}
