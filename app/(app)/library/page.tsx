export const dynamic = "force-dynamic"

import { TopBar } from "@/components/shared/top-bar"
import { PageHeader } from "@/components/shared/page-header"
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
      <div className="flex-1 px-6 sm:px-10 py-10 lg:py-14">
        <div className="mx-auto w-full max-w-6xl space-y-8">
          <PageHeader
            title="Library"
            description="Reusable starting points for recurring content. Save any post as a template from the composer kebab."
          />
          <LibraryView templates={templates} categories={categories} ctas={ctas} />
        </div>
      </div>
    </>
  )
}
