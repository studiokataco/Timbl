import type { ReactNode } from "react"

import { PageHeader } from "@/components/shared/page-header"

export function SettingsPage({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="@container mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6 md:pt-8 lg:px-10">
      <PageHeader
        size="sm"
        title={title}
        description={description}
        action={action}
        className="flex-col items-start gap-4 @2xl:flex-row @2xl:items-end @2xl:gap-6"
      />
      <div className="mt-6">{children}</div>
    </div>
  )
}
