import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { DevBanner } from "@/components/shared/dev-banner"
import { ThemeProvider } from "@/components/shared/theme-provider"

/*
 * DESIGN.md specifies Haas Grotesk as the primary typeface. Haas is proprietary,
 * so we substitute Geist Sans as the closest free analogue — both are humanist
 * sans-serifs in the Helvetica/Inter family. Swap in a licensed Haas variant
 * later if the studio acquires a foundry licence.
 */
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "Social planner — SAFE",
    template: "%s · Social planner",
  },
  description:
    "Calendar-first social media planning for the SAFE Foundation team.",
  applicationName: "Social planner",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <DevBanner />
          {children}
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
