import { db, ensureEmulator, SAFE_ORG_ID } from "./_helpers"

/* One-shot verifier - counts seeded docs to confirm Phase 1 acceptance. */
async function main() {
  ensureEmulator()
  const orgRef = db().doc(`organizations/${SAFE_ORG_ID}`)
  const orgSnap = await orgRef.get()
  if (!orgSnap.exists) throw new Error("Demo org not found")
  console.log(`✓ org: ${orgSnap.data()?.name}`)

  const [users, ctas, categories] = await Promise.all([
    orgRef.collection("users").count().get(),
    orgRef.collection("ctas").count().get(),
    orgRef.collection("categories").count().get(),
  ])
  console.log(`✓ users: ${users.data().count}`)
  console.log(`✓ ctas: ${ctas.data().count}`)
  console.log(`✓ categories: ${categories.data().count}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
