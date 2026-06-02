export const dynamic = "force-dynamic"

import { PageHeader } from "@/components/shared/page-header"
import { TemplatesView } from "@/components/templates/templates-view"
import { fetchTemplates } from "@/lib/queries/templates.server"
import { fetchCategories, fetchCtas } from "@/lib/queries/posts.server"

export default async function TemplatesPage() {
  const [templates, categories, ctas] = await Promise.all([
    fetchTemplates(),
    fetchCategories(),
    fetchCtas(),
  ])

  return (
    <>
      <div className="flex-1 px-6 sm:px-10 py-10 lg:py-14">
        <div className="mx-auto w-full max-w-6xl space-y-8">
          <PageHeader
            title="Templates"
            description="Reusable starting points for recurring content."
          />
          <TemplatesView templates={templates} categories={categories} ctas={ctas} />
        </div>
      </div>
    </>
  )
}
