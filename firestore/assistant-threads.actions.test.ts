import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { deleteApp, initializeApp, type App } from "firebase-admin/app"
import { getFirestore, type Firestore } from "firebase-admin/firestore"

/*
 * Runs the real chat server actions against the Firestore emulator as two
 * members of one workspace, so ownership, sharing, pins and read state are
 * checked end to end. Uses its own project id, so app data is never touched.
 *
 * Run via:  pnpm test:rules
 */

const ORG = "org-chat"
const viewer = vi.hoisted(() => ({ id: "alice", role: "contributor" as "admin" | "editor" | "contributor" }))
const handles = vi.hoisted(() => ({ db: null as Firestore | null }))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/auth/server-helpers", () => ({
  getCurrentOrgId: async () => ORG,
  getCurrentUser: async () => ({ id: viewer.id, email: `${viewer.id}@example.com`, name: viewer.id, role: viewer.role }),
  getDb: () => handles.db,
}))

const actions = await import("@/lib/actions/assistant-threads")

let app: App

function as(id: string, role: "admin" | "editor" | "contributor" = "contributor") {
  viewer.id = id
  viewer.role = role
}

function entry(id: string, role: "user" | "assistant", text: string, createdAt: number) {
  return { id, role, text, createdAt }
}

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("FIRESTORE_EMULATOR_HOST must point at the emulator")
  app = initializeApp({ projectId: "timbl-actions-test" }, "actions-test")
  handles.db = getFirestore(app)
})

afterAll(async () => {
  await deleteApp(app)
})

beforeEach(async () => {
  const snap = await handles.db!.collection(`organizations/${ORG}/assistantThreads`).get()
  await Promise.all(snap.docs.map((doc) => doc.ref.delete()))
})

describe("chat ownership and sharing", () => {
  it("a new chat belongs to its creator and stays private", async () => {
    as("alice")
    const saved = await actions.saveAssistantThread({
      id: "c1",
      transcript: [entry("u1", "user", "plan our diwali week", 1000), entry("a1", "assistant", "Here is a shape", 2000)],
    })
    expect(saved.ok).toBe(true)

    const mine = await actions.listAssistantThreads()
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ id: "c1", title: "Plan our diwali week", mine: true, visibility: "private", lastAt: 2000 })

    as("bob")
    expect(await actions.listAssistantThreads()).toHaveLength(0)
    expect(await actions.getAssistantThreadAccess("c1")).toBe("private")
    expect((await actions.fetchAssistantThread("c1")).transcript).toHaveLength(0)
    expect((await actions.saveAssistantThread({ id: "c1", transcript: [] })).ok).toBe(false)
  })

  it("sharing shows the chat to the workspace; only the owner manages it", async () => {
    as("alice")
    await actions.saveAssistantThread({ id: "c2", transcript: [entry("u1", "user", "Reel ideas", 1000)] })
    expect((await actions.updateAssistantThread("c2", { visibility: "workspace" })).ok).toBe(true)

    as("bob")
    const shared = await actions.listAssistantThreads()
    expect(shared.map((row) => row.id)).toEqual(["c2"])
    expect(shared[0]).toMatchObject({ mine: false, visibility: "workspace" })
    expect((await actions.updateAssistantThread("c2", { title: "Mine now" })).ok).toBe(false)
    expect((await actions.updateAssistantThread("c2", { archived: true })).ok).toBe(false)
    expect((await actions.deleteAssistantThread("c2")).ok).toBe(false)

    as("alice")
    expect((await actions.updateAssistantThread("c2", { title: "November reels" })).ok).toBe(true)
    expect((await actions.listAssistantThreads())[0]?.title).toBe("November reels")
    expect((await actions.deleteAssistantThread("c2")).ok).toBe(true)
    expect(await actions.listAssistantThreads()).toHaveLength(0)
  })

  it("pins are per person and archive is reversible", async () => {
    as("alice")
    await actions.saveAssistantThread({ id: "c3", transcript: [entry("u1", "user", "Launch caption", 1000)] })
    await actions.updateAssistantThread("c3", { visibility: "workspace" })

    as("bob")
    expect((await actions.updateAssistantThread("c3", { pinned: true })).ok).toBe(true)
    expect((await actions.listAssistantThreads())[0]?.pinned).toBe(true)

    as("alice")
    expect((await actions.listAssistantThreads())[0]?.pinned).toBe(false)
    await actions.updateAssistantThread("c3", { archived: true })
    expect((await actions.listAssistantThreads())[0]?.archived).toBe(true)
    await actions.updateAssistantThread("c3", { archived: false })
    expect((await actions.listAssistantThreads())[0]?.archived).toBe(false)
  })

  it("a reply after the last visit marks the chat unread", async () => {
    as("alice")
    await actions.saveAssistantThread({ id: "c4", transcript: [entry("u1", "user", "Friday post", 1000), entry("a1", "assistant", "Try a carousel", 2000)] })
    await actions.updateAssistantThread("c4", { read: true })
    expect((await actions.listAssistantThreads())[0]?.unread).toBe(false)

    const later = Date.now() + 60_000
    await actions.saveAssistantThread({
      id: "c4",
      transcript: [entry("u1", "user", "Friday post", 1000), entry("a1", "assistant", "Try a carousel", 2000), entry("a2", "assistant", "Drafts are ready", later)],
    })
    expect((await actions.listAssistantThreads())[0]?.unread).toBe(true)
  })

  it("a legacy shared chat is visible to all and managed by admins and editors", async () => {
    await handles.db!.doc(`organizations/${ORG}/assistantThreads/shell`).set({
      organizationId: ORG,
      visibility: "workspace",
      title: "Earlier chat",
      transcript: [entry("u1", "user", "Old question", 500)],
      lastMessageAt: 500,
    })
    as("bob")
    expect((await actions.listAssistantThreads())[0]).toMatchObject({ id: "shell", title: "Earlier chat", mine: false })
    expect((await actions.deleteAssistantThread("shell")).ok).toBe(false)
    as("eve", "editor")
    expect((await actions.updateAssistantThread("shell", { title: "Kept chat" })).ok).toBe(true)
  })
})
