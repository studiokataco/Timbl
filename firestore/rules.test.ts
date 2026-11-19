import { readFileSync } from "node:fs"
import path from "node:path"
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest"
import {
  type RulesTestEnvironment,
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing"
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  query,
  updateDoc,
  where,
} from "firebase/firestore"

/*
 * Emulator-driven test for firestore.rules. Two orgs, three roles, then
 * cross-org reads / role gates / contributor-assignee carveout.
 *
 * Run via:  pnpm test:rules
 * which wraps `firebase emulators:exec --only firestore` so this file
 * boots against a fresh emulator process each run.
 */

const PROJECT_ID = "timbl-rules-test"
const ORG_A = "org-a"
const ORG_B = "org-b"

type Role = "admin" | "editor" | "contributor"

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(
        path.resolve(__dirname, "firestore.rules"),
        "utf8",
      ),
      host: "127.0.0.1",
      port: 8080,
    },
  })

  /* Seed shared documents using the privileged context (rules bypassed). */
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, "organizations", ORG_A), {
      name: "Org A",
      slug: ORG_A,
    })
    await setDoc(doc(db, "organizations", ORG_B), {
      name: "Org B",
      slug: ORG_B,
    })
    await setDoc(doc(db, `organizations/${ORG_A}/posts/post-1`), {
      organizationId: ORG_A,
      title: "Org A post",
      assigneeId: "alice",
      status: "idea",
    })
    await setDoc(doc(db, `organizations/${ORG_A}/posts/post-2`), {
      organizationId: ORG_A,
      title: "Bob's post",
      assigneeId: "bob",
      status: "idea",
    })
    await setDoc(doc(db, `organizations/${ORG_B}/posts/post-1`), {
      organizationId: ORG_B,
      title: "Org B post",
      assigneeId: "carol",
      status: "idea",
    })
  })
})

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  /* Clear any per-test mutations - but keep the baseline seeds. */
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const snap = await getDocs(collection(db, `organizations/${ORG_A}/posts`))
    for (const d of snap.docs) {
      if (!["post-1", "post-2"].includes(d.id)) {
        await setDoc(d.ref, {}, { merge: false })
      }
    }
  })
})

function authed(uid: string, orgId: string, role: Role, userId = uid) {
  return env.authenticatedContext(uid, {
    organizationId: orgId,
    role,
    userId,
  })
}

describe("organizations subcollection reads", () => {
  it("allows in-org reads", async () => {
    const ctx = authed("alice-uid", ORG_A, "contributor", "alice")
    await assertSucceeds(getDoc(doc(ctx.firestore(), `organizations/${ORG_A}/posts/post-1`)))
  })

  it("denies cross-org reads", async () => {
    const ctx = authed("alice-uid", ORG_A, "admin", "alice")
    await assertFails(getDoc(doc(ctx.firestore(), `organizations/${ORG_B}/posts/post-1`)))
  })

  it("denies unauthenticated reads", async () => {
    const ctx = env.unauthenticatedContext()
    await assertFails(getDoc(doc(ctx.firestore(), `organizations/${ORG_A}/posts/post-1`)))
  })
})

/* Exercises the exact shape the client realtime listener uses
 * (usePostsRealtime): a windowed `getDocs` query over the org's posts
 * collection, authorized only by the organizationId custom claim. This is the
 * read that hits firestore.rules with real traffic at Phase 7 cutover. */
describe("realtime posts list query (onSnapshot shape)", () => {
  const win = (postsCol: ReturnType<typeof collection>) =>
    query(
      postsCol,
      where("scheduledDate", ">=", "2026-01-01"),
      where("scheduledDate", "<=", "2026-12-31"),
    )

  beforeAll(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `organizations/${ORG_A}/posts/rt-1`), {
        organizationId: ORG_A,
        title: "Dated post",
        status: "idea",
        scheduledDate: "2026-06-01",
      })
    })
  })

  it("allows an org member to stream their own org's window", async () => {
    const ctx = authed("alice-uid", ORG_A, "contributor", "alice")
    await assertSucceeds(
      getDocs(win(collection(ctx.firestore(), `organizations/${ORG_A}/posts`))),
    )
  })

  it("denies streaming another org's window", async () => {
    const ctx = authed("alice-uid", ORG_A, "admin", "alice")
    await assertFails(
      getDocs(win(collection(ctx.firestore(), `organizations/${ORG_B}/posts`))),
    )
  })

  it("denies a claimless (orgless) user", async () => {
    const ctx = env.authenticatedContext("ghost-uid", {})
    await assertFails(
      getDocs(win(collection(ctx.firestore(), `organizations/${ORG_A}/posts`))),
    )
  })

  it("denies an anonymous user", async () => {
    const ctx = env.unauthenticatedContext()
    await assertFails(
      getDocs(win(collection(ctx.firestore(), `organizations/${ORG_A}/posts`))),
    )
  })
})

describe("posts mutations", () => {
  it("contributor can update own post", async () => {
    const ctx = authed("alice-uid", ORG_A, "contributor", "alice")
    await assertSucceeds(
      setDoc(
        doc(ctx.firestore(), `organizations/${ORG_A}/posts/post-1`),
        { status: "designing", organizationId: ORG_A, assigneeId: "alice", title: "Org A post" },
        { merge: true },
      ),
    )
  })

  it("contributor cannot update someone else's post", async () => {
    const ctx = authed("alice-uid", ORG_A, "contributor", "alice")
    await assertFails(
      setDoc(
        doc(ctx.firestore(), `organizations/${ORG_A}/posts/post-2`),
        { status: "designing" },
        { merge: true },
      ),
    )
  })

  it("editor can update any in-org post", async () => {
    const ctx = authed("editor-uid", ORG_A, "editor", "ed")
    await assertSucceeds(
      setDoc(
        doc(ctx.firestore(), `organizations/${ORG_A}/posts/post-2`),
        { status: "scheduled" },
        { merge: true },
      ),
    )
  })

  it("contributor cannot delete a post", async () => {
    const ctx = authed("alice-uid", ORG_A, "contributor", "alice")
    await assertFails(
      deleteDoc(doc(ctx.firestore(), `organizations/${ORG_A}/posts/post-1`)),
    )
  })
})

describe("statusHistory append-only", () => {
  it("in-org user can append an event", async () => {
    const ctx = authed("alice-uid", ORG_A, "contributor", "alice")
    await assertSucceeds(
      setDoc(
        doc(ctx.firestore(), `organizations/${ORG_A}/posts/post-1/statusHistory/ev-1`),
        { at: serverTimestamp(), from: "idea", to: "designing", actorId: "alice" },
      ),
    )
  })

  it("cross-org user cannot append", async () => {
    const ctx = authed("eve-uid", ORG_B, "admin", "eve")
    await assertFails(
      setDoc(
        doc(ctx.firestore(), `organizations/${ORG_A}/posts/post-1/statusHistory/ev-2`),
        { at: serverTimestamp(), from: "idea", to: "scheduled", actorId: "eve" },
      ),
    )
  })
})

describe("awarenessDays", () => {
  it("any signed-in user can read", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "awarenessDays", "earth-day"), {
        name: "Earth Day",
        date: "2026-04-22",
      })
    })
    const ctx = authed("alice-uid", ORG_A, "contributor", "alice")
    await assertSucceeds(
      getDocs(query(collection(ctx.firestore(), "awarenessDays"), where("name", "==", "Earth Day"))),
    )
  })

  it("non-platform-admin cannot write", async () => {
    const ctx = authed("admin-uid", ORG_A, "admin", "admin")
    await assertFails(
      setDoc(doc(ctx.firestore(), "awarenessDays", "evil-day"), { name: "Evil Day" }),
    )
  })
})

describe("assistantThreads", () => {
  const base = `organizations/${ORG_A}/assistantThreads`

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, `${base}/private-chat`), { organizationId: ORG_A, ownerId: "alice", visibility: "private", pinnedBy: [], title: "Alice only" })
      await setDoc(doc(db, `${base}/shared-chat`), { organizationId: ORG_A, ownerId: "alice", visibility: "workspace", pinnedBy: [], title: "For the team" })
      await setDoc(doc(db, `${base}/shell`), { organizationId: ORG_A, title: "Earlier chat" })
    })
  })

  it("the owner reads a private chat", async () => {
    const ctx = authed("alice-uid", ORG_A, "contributor", "alice")
    await assertSucceeds(getDoc(doc(ctx.firestore(), `${base}/private-chat`)))
  })

  it("another member cannot read a private chat", async () => {
    const ctx = authed("bob-uid", ORG_A, "admin", "bob")
    await assertFails(getDoc(doc(ctx.firestore(), `${base}/private-chat`)))
  })

  it("another member reads a shared chat and a legacy chat", async () => {
    const ctx = authed("bob-uid", ORG_A, "contributor", "bob")
    await assertSucceeds(getDoc(doc(ctx.firestore(), `${base}/shared-chat`)))
    await assertSucceeds(getDoc(doc(ctx.firestore(), `${base}/shell`)))
  })

  it("another org cannot read a shared chat", async () => {
    const ctx = authed("carol-uid", ORG_B, "admin", "carol")
    await assertFails(getDoc(doc(ctx.firestore(), `${base}/shared-chat`)))
  })

  it("another member may pin a shared chat but not rename it", async () => {
    const ctx = authed("bob-uid", ORG_A, "contributor", "bob")
    await assertSucceeds(updateDoc(doc(ctx.firestore(), `${base}/shared-chat`), { pinnedBy: ["bob"] }))
    await assertFails(updateDoc(doc(ctx.firestore(), `${base}/shared-chat`), { title: "Mine now" }))
  })

  it("nobody can hand a chat to someone else", async () => {
    const ctx = authed("alice-uid", ORG_A, "contributor", "alice")
    await assertFails(updateDoc(doc(ctx.firestore(), `${base}/private-chat`), { ownerId: "bob" }))
  })

  it("a new chat must belong to its creator", async () => {
    const ctx = authed("bob-uid", ORG_A, "contributor", "bob")
    await assertSucceeds(setDoc(doc(ctx.firestore(), `${base}/bob-chat`), { organizationId: ORG_A, ownerId: "bob", visibility: "private" }))
    await assertFails(setDoc(doc(ctx.firestore(), `${base}/forged-chat`), { organizationId: ORG_A, ownerId: "alice", visibility: "private" }))
  })

  it("only the owner deletes a chat; a legacy chat needs an admin or editor", async () => {
    const bob = authed("bob-uid", ORG_A, "contributor", "bob")
    await assertFails(deleteDoc(doc(bob.firestore(), `${base}/shared-chat`)))
    await assertFails(deleteDoc(doc(bob.firestore(), `${base}/shell`)))
    const alice = authed("alice-uid", ORG_A, "contributor", "alice")
    await assertSucceeds(deleteDoc(doc(alice.firestore(), `${base}/shared-chat`)))
    const editor = authed("eve-uid", ORG_A, "editor", "eve")
    await assertSucceeds(deleteDoc(doc(editor.firestore(), `${base}/shell`)))
  })
})

describe("collections with their own rules are not opened by the default", () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, `organizations/${ORG_A}/socialAccounts/linkedin:1`), { organizationId: ORG_A, channel: "linkedin" })
      await setDoc(doc(db, `organizations/${ORG_A}/publishRuns/run-1`), { organizationId: ORG_A, status: "ok" })
      await setDoc(doc(db, `organizations/${ORG_A}/oauthApps/linkedin`), { organizationId: ORG_A, channel: "linkedin" })
    })
  })

  it("social accounts and oauth apps are readable by admins and editors only", async () => {
    const contributor = authed("alice-uid", ORG_A, "contributor", "alice")
    await assertFails(getDoc(doc(contributor.firestore(), `organizations/${ORG_A}/socialAccounts/linkedin:1`)))
    await assertFails(getDoc(doc(contributor.firestore(), `organizations/${ORG_A}/oauthApps/linkedin`)))
    const editor = authed("eve-uid", ORG_A, "editor", "eve")
    await assertSucceeds(getDoc(doc(editor.firestore(), `organizations/${ORG_A}/socialAccounts/linkedin:1`)))
    await assertSucceeds(getDoc(doc(editor.firestore(), `organizations/${ORG_A}/oauthApps/linkedin`)))
  })

  it("nobody writes publish runs or social accounts from the client", async () => {
    const admin = authed("admin-uid", ORG_A, "admin", "admin")
    await assertFails(setDoc(doc(admin.firestore(), `organizations/${ORG_A}/publishRuns/run-2`), { organizationId: ORG_A }))
    await assertFails(setDoc(doc(admin.firestore(), `organizations/${ORG_A}/socialAccounts/x:1`), { organizationId: ORG_A }))
    const contributor = authed("alice-uid", ORG_A, "contributor", "alice")
    await assertSucceeds(getDoc(doc(contributor.firestore(), `organizations/${ORG_A}/publishRuns/run-1`)))
  })
})
