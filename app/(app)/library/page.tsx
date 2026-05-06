export const dynamic = "force-dynamic"

import { TopBar } from "@/components/shared/top-bar"
import { LibraryView } from "@/components/library/library-view"
import { fetchTemplates } from "@/lib/queries/templates.server"
import { fetchCategories, fetchCtas } from "@/lib/queries/posts.server"

export default async function LibraryPage() {
  const [templates, categories, ctas] = await Promise.all([
    fetchTemplates(),
    fetchCategories(),
    fetchCtas(),
  ])

  return (
    <>
      <TopBar />
      <div className="px-4 sm:px-6 py-4 flex-1">
        <div className="mb-4">
          <h1 className="text-lg font-medium">Library</h1>
          <p className="text-xs text-muted-foreground">
            Reusable starting points for recurring content.
          </p>
        </div>
        <LibraryView templates={templates} categories={categories} ctas={ctas} />
      </div>
    </>
  )
}
