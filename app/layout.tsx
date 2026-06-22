import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { siteUrl } from "@/lib/seo"
import { Toaster } from "@/components/ui/sonner"
import { DevBanner } from "@/components/shared/dev-banner"
import { ThemeProvider, ThemeNoFlashScript } from "@/components/shared/theme-provider"
import { PostHogProvider } from "@/components/shared/posthog-provider"


const interSans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
})

const description =
  "An AI Social planner that works with you. Plan campaigns and posts across Instagram, Facebook, LinkedIn and X from one calendar or kanban. Timbl's agents draft and schedule - you approve every post before it ships."

const TITLE = "Timbl - AI Social Media Planner"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: TITLE,
    template: "%s · Timbl",
  },
  description,
  applicationName: "Timbl",
  keywords: [
    "social media planner",
    "social media scheduler",
    "social media management",
    "content calendar",
    "social media scheduling tool",
    "AI social media planner",
    "social media calendar for agencies",
    "kanban content planner",
    "campaign planning",
    "agentic planner",
  ],
  openGraph: {
    siteName: "Timbl",
    type: "website",
    locale: "en_US",
    url: siteUrl(),
    title: TITLE,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description,
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Timbl",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: siteUrl(),
  description,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  publisher: { "@type": "Organization", name: "Timbl", url: siteUrl() },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${interSans.variable} ${jetbrainsMono.variable} h-full motion-safe:scroll-smooth antialiased`}
    >
      <head>
        <ThemeNoFlashScript />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="h-screen overflow-hidden flex flex-col bg-background text-foreground">
        <PostHogProvider>
          <ThemeProvider defaultTheme="system">
            <DevBanner />
            {children}
            <Toaster richColors position="bottom-right" />
          </ThemeProvider>
        </PostHogProvider>
      </body>
    </html>
  )
}
