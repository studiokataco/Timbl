import { db, ensureEmulator, TIMBL_DEMO_ORG_ID } from "./_helpers"

const GROUP_MAP: Record<string, "active" | "done" | "closed"> = {
  idea: "active",
  brief: "active",
  researching: "active",
  designing: "active",
  review: "active",
  scheduled: "done",
  posted: "done",
  missed: "closed",
  archived: "closed",
}

export async function seed0015KanbanGroups() {
  ensureEmulator()
  const col = db()
    .doc(`organizations/${TIMBL_DEMO_ORG_ID}`)
    .collection("kanbanColumns")

  const snap = await col.limit(1).get()
  if (!snap.empty && snap.docs[0].get("group") !== undefined) {
    console.log("✓ kanban groups: already patched, skipping")
    return
  }

  const all = await col.get()
  let count = 0
  for (const doc of all.docs) {
    const group = GROUP_MAP[doc.id]
    if (group) {
      await doc.ref.set({ group, updatedAt: new Date().toISOString() }, { merge: true })
      count++
    }
  }
  console.log(`✓ kanban groups: patched ${count} columns`)
}

if (require.main === module) {
  seed0015KanbanGroups().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
