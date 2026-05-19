export const dynamic = "force-dynamic"

import { listCategoriesForSettings } from "@/lib/actions/categories"
import { CategoriesManager } from "@/components/settings/categories-manager"

export default async function SettingsCategoriesPage() {
  const categories = await listCategoriesForSettings()

  return (
    <div className="px-4 sm:px-6 py-4 flex-1">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-medium">Manage categories</h1>
          <p className="text-xs text-muted-foreground">
            Categories drive post colors, default types, and the calendar
            grouping. Drag to reorder.
          </p>
        </div>
      </div>
      <CategoriesManager categories={categories} />
    </div>
  )
}
