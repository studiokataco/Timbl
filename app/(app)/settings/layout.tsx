import { SettingsRail, SettingsTabs, type SettingsNavData } from "@/components/shared/settings-nav"
import { getCurrentUserProfile, getCurrentWorkspaceIdentity } from "@/lib/identity/profile.server"
import { getBrandSwitcherData } from "@/lib/queries/brands.server"

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const [user, workspace, brands] = await Promise.all([
    getCurrentUserProfile(),
    getCurrentWorkspaceIdentity(),
    getBrandSwitcherData(),
  ])
  const nav: SettingsNavData = {
    user: { name: user.name, email: user.email, avatarUrl: user.avatarUrl },
    workspace: {
      name: workspace.name,
      logoUrl: workspace.logoUrl,
      color: workspace.color,
      planLabel: workspace.planLabel,
    },
    brandCount: brands.brands.length,
  }

  return (
    <div className="flex flex-1">
      <aside className="hidden w-64 shrink-0 border-r border-border lg:block">
        <div className="sticky top-16">
          <SettingsRail data={nav} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="lg:hidden">
          <SettingsTabs data={nav} />
        </div>
        {children}
      </div>
    </div>
  )
}
