import { AgentPipeline } from "./agent-pipeline"
import { CtaBand } from "./cta-band"
import { FeatureShowcase } from "./feature-showcase"
import { Features } from "./features"
import { Hero } from "./hero"
import { HowItWorks } from "./how-it-works"
import { MarketingFooter } from "./marketing-footer"
import { MarketingNav } from "./marketing-nav"
import { PostDeck } from "./post-deck"
import { ScrollStack } from "./scroll-stack"
import { StatCounters } from "./stat-counters"
import { Testimonials } from "./testimonials"

export function LandingPage() {
  return (
    <div id="landing-scroll" className="flex-1 overflow-y-auto bg-background text-foreground">
      <MarketingNav />
      <main>
        <Hero />
        <StatCounters />
        <Features />
        <FeatureShowcase />
        <ScrollStack />
        <PostDeck />
        <AgentPipeline />
        <HowItWorks />
        <Testimonials />
        <CtaBand />
      </main>
      <MarketingFooter />
    </div>
  )
}
