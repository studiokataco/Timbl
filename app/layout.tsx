import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { DevBanner } from "@/components/shared/dev-banner"
import { ThemeProvider, ThemeNoFlashScript } from "@/components/shared/theme-provider"

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

export const metadata: Metadata = {
  title: {
    default: "Social planner",
    template: "%s · Social planner",
  },
  description: "Calendar-first social media planning for agencies and brands.",
  applicationName: "Social planner",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
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
        <ThemeProvider defaultTheme="system">
          <DevBanner />
          {children}
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
