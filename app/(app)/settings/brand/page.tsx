import { BrandWizardClient } from "./client"

export const dynamic = "force-dynamic"

export default function SettingsBrandPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] min-h-0 px-4 sm:px-6 py-4">
      <header className="mb-3">
        <h1 className="text-title-sm text-foreground">Brand</h1>
        <p className="text-body-sm text-muted-foreground">
          Teach the AI your brand voice, audience, channels, and posting cadence.
        </p>
      </header>
      <BrandWizardClient />
    </div>
  )
}
