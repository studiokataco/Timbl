import { QueryProvider } from "@/components/shared/query-provider"

/*
 * Onboarding shell. Lives OUTSIDE the (app) layout group so the
 * first-launch redirect can't loop on itself. No sidebar, no top bar,
 * no command palette - pure focus on the wizard.
 */
export const metadata = { robots: { index: false, follow: false } }

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <QueryProvider>{children}</QueryProvider>
}
