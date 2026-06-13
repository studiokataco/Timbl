import { conversationSchema } from "@/lib/schemas/conversation"
import { messageSchema } from "@/lib/schemas/message"
import { assignmentSchema } from "@/lib/schemas/assignment"
import { db, ensureEmulator, TIMBL_DEMO_ORG_ID, DEMO_ADMIN_USER_ID, nowIso } from "./_helpers"

export async function seed0014InboxFixtures() {
  ensureEmulator()
  const orgId = TIMBL_DEMO_ORG_ID
  const d = db()

  const convId = "inbox-conv-001"
  const msgId = "inbox-msg-001"
  const assignId = "inbox-assign-001"
  const now = nowIso()

  const conv = conversationSchema.parse({
    id: convId,
    organizationId: orgId,
    channel: "instagram",
    externalThreadId: "ig-thread-abc123",
    participantHandle: "@timbl.demo.user",
    lastMessageAt: now,
    status: "open",
    createdAt: now,
    updatedAt: now,
  })

  const msg = messageSchema.parse({
    id: msgId,
    organizationId: orgId,
    conversationId: convId,
    direction: "in",
    body: "Hi! I love your content - can you collaborate?",
    mediaUrls: [],
    externalMessageId: "ig-msg-xyz789",
    sentAt: now,
    createdAt: now,
    updatedAt: now,
  })

  const assignment = assignmentSchema.parse({
    id: assignId,
    organizationId: orgId,
    conversationId: convId,
    assigneeUserId: DEMO_ADMIN_USER_ID,
    assignedAt: now,
    assignedByUserId: DEMO_ADMIN_USER_ID,
    createdAt: now,
    updatedAt: now,
  })

  const base = `organizations/${orgId}`
  await Promise.all([
    d.doc(`${base}/conversations/${convId}`).set(conv),
    d.doc(`${base}/messages/${msgId}`).set(msg),
    d.doc(`${base}/assignments/${assignId}`).set(assignment),
  ])

  console.log("  0014 inbox fixtures seeded")
}
