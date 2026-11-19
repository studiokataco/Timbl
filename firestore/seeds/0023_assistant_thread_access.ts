import { getAdminApp, getAdminDb } from "@/lib/firebase/admin"
import { orgAssistantThreadsPath } from "@/lib/firebase/paths"
import { TIMBL_FIREBASE_PROJECT_PROD } from "@/lib/constants/timbl"

/* Migration 0023 - chats gain owners. Threads written before owners existed
 * (the shared "shell" chat) stay visible to the whole workspace, and every
 * thread gets the list fields the chat history reads (last message time,
 * last reply time, a title from the first message). Idempotent. */

type Entry = { role?: string; text?: string; createdAt?: number }

const TITLE_MAX = 60

function titleFrom(text: string | undefined): string | undefined {
  const clean = (text ?? "").replace(/\s+/g, " ").trim()
  if (!clean) return undefined
  const capped = clean.length > TITLE_MAX ? `${clean.slice(0, TITLE_MAX - 3).trimEnd()}...` : clean
  return capped.charAt(0).toUpperCase() + capped.slice(1)
}

export async function migrate0023AssistantThreadAccess(): Promise<void> {
  const emulator = process.env.FIRESTORE_EMULATOR_HOST
  if (!emulator && process.env.CONFIRM_PROD_MIGRATION !== "1") {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST is not set - this run would write to a real " +
        "Firestore. Re-run with CONFIRM_PROD_MIGRATION=1 if that is intended.",
    )
  }

  const projectId = getAdminApp().options.projectId
  if (!emulator) {
    const expected = process.env.EXPECT_PROJECT_ID
    if (!expected) {
      throw new Error(
        `Resolved Firestore project is "${projectId}". Re-run with ` +
          `EXPECT_PROJECT_ID=${projectId} to confirm (production is ` +
          `${TIMBL_FIREBASE_PROJECT_PROD}).`,
      )
    }
    if (expected !== projectId) {
      throw new Error(
        `EXPECT_PROJECT_ID="${expected}" but the Admin SDK resolved ` +
          `"${projectId}". Set NEXT_PUBLIC_FIREBASE_PROJECT_ID=${expected} and retry.`,
      )
    }
  }

  console.log(
    emulator
      ? `→ migration 0023 against emulator @ ${emulator} (project ${projectId})`
      : `→ migration 0023 against REAL Firestore project ${projectId}`,
  )

  const db = getAdminDb()
  const orgs = await db.collection("organizations").get()
  let shared = 0
  let indexed = 0
  let untouched = 0
  for (const org of orgs.docs) {
    const threads = await db.collection(orgAssistantThreadsPath(org.id)).get()
    for (const thread of threads.docs) {
      const data = thread.data()
      const patch: Record<string, unknown> = {}
      if (!data.ownerId && data.visibility !== "workspace") {
        patch.visibility = "workspace"
        shared++
      }
      const transcript: Entry[] = Array.isArray(data.transcript) ? data.transcript : []
      if (transcript.length && data.lastMessageAt === undefined) {
        let lastMessageAt = 0
        let lastAssistantAt = 0
        for (const entry of transcript) {
          const at = typeof entry.createdAt === "number" ? entry.createdAt : 0
          lastMessageAt = Math.max(lastMessageAt, at)
          if (entry.role === "assistant") lastAssistantAt = Math.max(lastAssistantAt, at)
        }
        if (lastMessageAt) patch.lastMessageAt = lastMessageAt
        if (lastAssistantAt) patch.lastAssistantAt = lastAssistantAt
        const autoTitle = titleFrom(transcript.find((entry) => entry.role === "user" && entry.text?.trim())?.text)
        if (autoTitle) patch.autoTitle = autoTitle
        indexed++
      }
      if (!data.title && !patch.autoTitle && !data.autoTitle && !data.ownerId) patch.title = "Earlier chat"
      if (Object.keys(patch).length) await thread.ref.update(patch)
      else untouched++
    }
  }

  console.log(`✓ migration 0023: ${shared} shared with the workspace, ${indexed} indexed, ${untouched} already current`)
}

if (require.main === module) {
  migrate0023AssistantThreadAccess().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
