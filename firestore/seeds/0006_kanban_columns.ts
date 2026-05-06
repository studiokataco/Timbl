import { db, ensureEmulator, SAFE_ORG_ID, withAudit } from "./_helpers"

/*
 * Seeds 9 default kanban columns matching the legacy PostStatus enum so the
 * board renders the same shape as before. Idempotent: only writes if the
 * collection is empty. After the user customises columns we never touch them
 * again.
 */
type ColumnSeed = { id: string; label: string; color: string }

const COLUMNS: ColumnSeed[] = [
  { id: "idea", label: "Idea", color: "#94a3b8" },
  { id: "brief", label: "Brief", color: "#fbbf24" },
  { id: "researching", label: "Researching", color: "#fb923c" },
  { id: "designing", label: "Designing", color: "#ec4899" },
  { id: "review", label: "Review", color: "#8b5cf6" },
  { id: "scheduled", label: "Scheduled", color: "#3b82f6" },
  { id: "posted", label: "Posted", color: "#10b981" },
  { id: "missed", label: "Missed", color: "#ef4444" },
  { id: "archived", label: "Archived", color: "#64748b" },
]

export async function seed0006KanbanColumns() {
  ensureEmulator()
  const col = db()
    .doc(`organizations/${SAFE_ORG_ID}`)
    .collection("kanbanColumns")

  const existing = await col.limit(1).get()
  if (!existing.empty) {
    console.log("✓ kanban columns: already seeded, skipping")
    return
  }

  for (let i = 0; i < COLUMNS.length; i++) {
    const c = COLUMNS[i]
    await col.doc(c.id).set(
      withAudit({
        id: c.id,
        organizationId: SAFE_ORG_ID,
        label: c.label,
        color: c.color,
        sortOrder: i,
        isSystemDefault: true,
      }),
    )
  }
  console.log(`✓ kanban columns: ${COLUMNS.length}`)
}

if (require.main === module) {
  seed0006KanbanColumns().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
