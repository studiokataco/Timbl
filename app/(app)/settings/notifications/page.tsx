export const dynamic = "force-dynamic"

import { ReminderSettings } from "@/components/settings/reminder-settings"
import { getReminderSettings } from "@/lib/actions/reminder-settings"

export default async function SettingsNotificationsPage() {
  const initial = await getReminderSettings()

  return (
    <div className="px-4 sm:px-6 py-4 flex-1">
      <div className="mb-4">
        <h1 className="text-lg font-medium">Notifications</h1>
        <p className="text-xs text-muted-foreground">
          Control when reminder toasts appear, how often, and thresholds for
          each type.
        </p>
      </div>
      <ReminderSettings initial={initial} />
    </div>
  )
}
