export const dynamic = "force-dynamic"

import { listCategoriesForSettings } from "@/lib/actions/categories"
import { fetchKanbanColumnsWithCounts } from "@/lib/queries/kanban-columns.server"
import { CategoriesManager } from "@/components/settings/categories-manager"
import { StatusesManager } from "@/components/settings/statuses-manager"
import { SettingsSection } from "@/components/settings/settings-section"

export default async function SettingsCategoriesPage() {
  const [categories, { columns, postCountByStatus }] = await Promise.all([
    listCategoriesForSettings(),
    fetchKanbanColumnsWithCounts(),
  ])

  return (
    <div className="px-4 sm:px-6 pt-4 pb-24 flex-1">
      <SettingsSection
        title="Categories"
        description="Drive post colors, default types, and calendar grouping. Drag to reorder."
        isFirst
      >
        <CategoriesManager categories={categories} />
      </SettingsSection>

      <SettingsSection
        title="Workflow statuses"
        description="The columns posts move through on the kanban board. Rename, recolor, reorder, add, or remove. Scheduled and Posted are required by publishing."
      >
        <StatusesManager columns={columns} postCountByStatus={postCountByStatus} />
      </SettingsSection>
    </div>
  )
}
