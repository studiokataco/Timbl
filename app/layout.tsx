import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { siteUrl } from "@/lib/seo"
import { Toaster } from "@/components/ui/sonner"
import { AiTestingBanner } from "@/components/shared/ai-testing-banner"
import { DevBanner } from "@/components/shared/dev-banner"
import { ThemeProvider, ThemeNoFlashScript } from "@/components/shared/theme-provider"
import { PostHogProvider } from "@/components/shared/posthog-provider"

/*
 * Cal.com's brand voice splits into Cal Sans (custom display) + Inter (everything
 * else). Cal Sans is proprietary; per DESIGN.md the recommended substitute is
 * Inter at weight 600 with -0.04em tracking (applied via Tailwind's `tracking-tight`
 * on display headings). JetBrains Mono is Cal's stated mono.
 */
const interSans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
})

const description =
  "Timbl is a calendar-first social media planner for agencies and brands - AI agents help plan, draft and schedule posts across every channel."

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Timbl",
    template: "%s · Timbl",
  },
  description,
  applicationName: "Timbl",
  keywords: [
    "social media planner",
    "content calendar",
    "social media scheduler",
    "social media management",
    "agency",
    "AI social media",
    "content planning",
  ],
  openGraph: {
    siteName: "Timbl",
    type: "website",
    locale: "en_US",
    url: siteUrl(),
    title: "Timbl",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Timbl",
    description,
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${interSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <ThemeNoFlashScript />
      </head>
      <body className="h-screen overflow-hidden flex flex-col bg-background text-foreground">
        <PostHogProvider>
          <ThemeProvider defaultTheme="system">
            <DevBanner />
            <AiTestingBanner />
            {children}
            <Toaster richColors position="bottom-right" />
          </ThemeProvider>
        </PostHogProvider>
      </body>
    </html>
  )
}
