import { seedSafeOrg } from "./0001_safe_org"
import { seedCategoriesAndCtas } from "./0002_categories_and_ctas"

/*
 * Seed runner. Phase 1 ships seeds 0001 + 0002. Later phases append more
 * (campaigns, templates, awareness days). Each seed is independently
 * idempotent so running this end-to-end repeatedly is safe.
 *
 * Usage:
 *   1. Start emulators in another terminal:  pnpm emulators
 *   2. Run seeds:                            pnpm seed
 */
async function main() {
  await seedSafeOrg()
  await seedCategoriesAndCtas()
  console.log("\nseed complete.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
