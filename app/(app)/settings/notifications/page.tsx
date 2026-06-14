export const dynamic = "force-dynamic"

import { ReminderSettings } from "@/components/settings/reminder-settings"
import { getReminderSettings } from "@/lib/actions/reminder-settings"

export default async function SettingsNotificationsPage() {
  const initial = await getReminderSettings()

  return (
    <div className="px-4 sm:px-6 py-4 flex-1">
      <ReminderSettings initial={initial} />
    </div>
  )
}
