import { AgentPipeline } from "./agent-pipeline"
import { CtaBand } from "./cta-band"
import { Features } from "./features"
import { Hero } from "./hero"
import { HowItWorks } from "./how-it-works"
import { MarketingFooter } from "./marketing-footer"
import { MarketingNav } from "./marketing-nav"

export function LandingPage() {
  return (
    <div className="flex-1 overflow-y-auto bg-background text-foreground">
      <MarketingNav />
      <main>
        <Hero />
        <Features />
        <AgentPipeline />
        <HowItWorks />
        <CtaBand />
      </main>
      <MarketingFooter />
    </div>
  )
}
