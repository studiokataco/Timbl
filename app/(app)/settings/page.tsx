import { SettingsOverview } from "@/components/settings/settings-overview"

/*
 * Settings landing - an overview of every settings surface. Previously
 * this route redirected straight to /settings/campaigns, which made
 * "Settings" land on a page that didn't look like settings. The
 * settings sub-nav (components/shared/settings-nav.tsx) carries "Overview"
 * as its first tab and points here.
 */
export default function SettingsIndexPage() {
  return <SettingsOverview />
}
