export const dynamic = "force-dynamic"

import { ProfileSettings } from "@/components/settings/profile-settings"
import { SettingsPage } from "@/components/settings/settings-page"
import { getCurrentUserProfile } from "@/lib/identity/profile.server"

export default async function SettingsProfilePage() {
  const profile = await getCurrentUserProfile()
  return (
    <SettingsPage
      title="Profile"
      description="How you show up to teammates, in every workspace you belong to."
    >
      <ProfileSettings profile={profile} />
    </SettingsPage>
  )
}
