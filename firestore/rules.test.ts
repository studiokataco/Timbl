import { readFileSync } from "node:fs"
import path from "node:path"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
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

const PROJECT_ID = "social-media-planner-rules-test"
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
  /* Clear any per-test mutations — but keep the baseline seeds. */
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
