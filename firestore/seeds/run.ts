import { seedSafeOrg } from "./0001_safe_org"
import { seedCategoriesAndCtas } from "./0002_categories_and_ctas"
import { seed0003Campaigns } from "./0003_campaigns"

/*
 * Seed runner. Each seed is independently idempotent — safe to re-run.
 *
 * Usage:
 *   1. Start emulators in another terminal:  pnpm emulators
 *   2. Run seeds:                            pnpm seed
 */
async function main() {
  await seedSafeOrg()
  await seedCategoriesAndCtas()
  await seed0003Campaigns()
  console.log("\nseed complete.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
