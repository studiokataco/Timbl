export const dynamic = "force-dynamic"

import { listCategoriesForSettings } from "@/lib/actions/categories"
import { fetchKanbanColumnsWithCounts } from "@/lib/queries/kanban-columns.server"
import { CategoriesManager } from "@/components/settings/categories-manager"
import { StatusesManager } from "@/components/settings/statuses-manager"

export default async function SettingsCategoriesPage() {
  const [categories, { columns, postCountByStatus }] = await Promise.all([
    listCategoriesForSettings(),
    fetchKanbanColumnsWithCounts(),
  ])

  return (
    <CategoriesManager
      categories={categories}
      statuses={<StatusesManager columns={columns} postCountByStatus={postCountByStatus} />}
    />
  )
}
