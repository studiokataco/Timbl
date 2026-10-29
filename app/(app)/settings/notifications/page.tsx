export const dynamic = "force-dynamic"

import { ReminderSettings } from "@/components/settings/reminder-settings"
import { SettingsPage } from "@/components/settings/settings-page"
import { getReminderSettings } from "@/lib/actions/reminder-settings"
import { fetchCategories } from "@/lib/queries/posts.server"

export default async function SettingsNotificationsPage() {
  const [initial, categories] = await Promise.all([
    getReminderSettings(),
    fetchCategories().catch(() => []),
  ])

  return (
    <SettingsPage
      title="Reminders"
      description="Nudges your team sees when they open Timbl, and how often."
    >
      <ReminderSettings initial={initial} sampleCategory={categories[0]?.name} />
    </SettingsPage>
  )
}
