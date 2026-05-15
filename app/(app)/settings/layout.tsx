import { SettingsNav } from "@/components/shared/settings-nav"

/*
 * Settings shell — horizontal sub-nav under the global TopBar (provided by
 * the root (app) layout). Each settings page renders only its own content
 * area; the layout owns chrome below TopBar. Keep page-level components
 * focused on their data, not on chrome positioning.
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <SettingsNav />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </>
  )
}
