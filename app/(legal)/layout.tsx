import { MarketingFooter } from "@/components/marketing/marketing-footer"
import { MarketingNav } from "@/components/marketing/marketing-nav"

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto bg-background text-foreground">
      <MarketingNav />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  )
}
