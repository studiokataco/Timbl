import { AgentPipeline } from "./agent-pipeline"
import { CtaBand } from "./cta-band"
import { Features } from "./features"
import { Hero } from "./hero"
import { HowItWorks } from "./how-it-works"
import { MarketingFooter } from "./marketing-footer"
import { MarketingNav } from "./marketing-nav"
import { PostDeck } from "./post-deck"

export function LandingPage() {
  return (
    <div
      id="landing-scroll"
      className="flex-1 overflow-y-auto motion-safe:scroll-smooth bg-background text-foreground"
    >
      <MarketingNav />
      <main>
        <Hero />
        <Features />
        <PostDeck />
        <AgentPipeline />
        <HowItWorks />
        <CtaBand />
      </main>
      <MarketingFooter />
    </div>
  )
}
