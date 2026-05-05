import { db, ensureEmulator, SAFE_ORG_ID, withAudit } from "./_helpers"

/* Phase 2 acceptance: write a post directly via Admin SDK, read it back. */
async function main() {
  ensureEmulator()
  const orgRef = db().doc(`organizations/${SAFE_ORG_ID}`)
  const ref = orgRef.collection("posts").doc("phase2-smoke")
  await ref.set(
    withAudit({
      id: "phase2-smoke",
      organizationId: SAFE_ORG_ID,
      scheduledDate: new Date().toISOString().slice(0, 10),
      status: "idea",
      categoryId: "ethical-boutique-pick",
      brief: "Phase 2 smoke test post",
      hashtags: ["#SmokeTest"],
      assetUrls: [],
      channelStatuses: {},
      postType: "grid",
    }),
    { merge: true },
  )
  const snap = await ref.get()
  console.log("✓ post written:", snap.exists, snap.data()?.brief)
  await ref.delete()
  console.log("✓ post cleanup ok")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
