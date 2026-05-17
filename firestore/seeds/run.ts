import { seedSafeOrg } from "./0001_safe_org"
import { seedCategoriesAndCtas } from "./0002_categories_and_ctas"
import { seed0003Campaigns } from "./0003_campaigns"
import { seed0004Templates } from "./0004_templates"
import { seed0005AwarenessDays } from "./0005_awareness_days"
import { seed0006KanbanColumns } from "./0006_kanban_columns"
import { seed0007AgentConfigs } from "./0007_agent_configs"
import { seed0008AwarenessResearcher } from "./0008_awareness_researcher"
import { seed0009EmbeddingsBackfill } from "./0009_embeddings_backfill"

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
  await seed0004Templates()
  await seed0005AwarenessDays()
  await seed0006KanbanColumns()
  await seed0007AgentConfigs()
  await seed0008AwarenessResearcher()
  await seed0009EmbeddingsBackfill()
  console.log("\nseed complete.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
