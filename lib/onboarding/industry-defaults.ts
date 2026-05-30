/*
 * Industry → starter content lookup. Used by the onboarding wizard to
 * pre-populate categories, suggested agents, and template hints based on
 * what the user picked at step one. Pure data - no Firestore access.
 *
 * Adding a new industry: append the constant below + a key in
 * INDUSTRY_DEFAULTS. The wizard renders the union of `industries` as
 * radio options; an industry without an entry here falls through to
 * GENERIC_DEFAULTS.
 *
 * Categories/templates here are *suggestions* - the wizard lets the user
 * deselect / customize before persisting via seeds/defaults.ts.
 */

export type IndustryId =
  | "agency"
  | "ecommerce"
  | "saas"
  | "nonprofit"
  | "creator"
  | "local-business"
  | "other"

export interface CategorySuggestion {
  slug: string
  name: string
  color: string
  icon: string
  defaultPostType: "grid" | "carousel" | "reel" | "story" | "video"
}

export interface IndustryDefaults {
  label: string
  description: string
  /* Agent ids the wizard pre-checks. The user can toggle them on step 2. */
  suggestedAgents: string[]
  categories: CategorySuggestion[]
  /* Template slugs that exist in `firestore/seeds/defaults.ts` library -
   * the wizard renders these on step 4 with copy preview. */
  templateSlugs: string[]
  /* Default tone hint that prefills the step-one textarea. */
  toneHint: string
}

const SIG = {
  coral: "#fb923c",
  pink: "#ec4899",
  violet: "#8b5cf6",
  emerald: "#34d399",
  forest: "#10b981",
  yellow: "#f59e0b",
  peach: "#fbcfe8",
  cream: "#fde68a",
}

export const GENERIC_DEFAULTS: IndustryDefaults = {
  label: "Other",
  description: "Generic starter categories. You can tailor everything later from Settings.",
  suggestedAgents: ["drafter", "ideator"],
  categories: [
    { slug: "announcements", name: "Announcements", color: SIG.coral, icon: "megaphone", defaultPostType: "grid" },
    { slug: "behind-the-scenes", name: "Behind the scenes", color: SIG.peach, icon: "camera", defaultPostType: "carousel" },
    { slug: "tips-howto", name: "Tips & how-to", color: SIG.emerald, icon: "lightbulb", defaultPostType: "carousel" },
    { slug: "events", name: "Events", color: SIG.violet, icon: "calendar", defaultPostType: "grid" },
  ],
  templateSlugs: ["generic-announcement", "generic-tip-carousel"],
  toneHint: "Warm, clear, professional.",
}

export const INDUSTRY_DEFAULTS: Record<IndustryId, IndustryDefaults> = {
  agency: {
    label: "Marketing / creative agency",
    description: "Multi-brand workflow with approval flows and reusable templates.",
    suggestedAgents: ["drafter", "cadence-planner", "approval-triage"],
    categories: [
      { slug: "client-wins", name: "Client wins", color: SIG.emerald, icon: "trophy", defaultPostType: "carousel" },
      { slug: "case-studies", name: "Case studies", color: SIG.violet, icon: "file-text", defaultPostType: "carousel" },
      { slug: "team-culture", name: "Team & culture", color: SIG.peach, icon: "users", defaultPostType: "grid" },
      { slug: "thought-leadership", name: "Thought leadership", color: SIG.coral, icon: "feather", defaultPostType: "grid" },
    ],
    templateSlugs: ["agency-case-study", "agency-client-win"],
    toneHint: "Confident, expert, results-driven.",
  },
  ecommerce: {
    label: "E-commerce / DTC brand",
    description: "Product-led storytelling with launches, drops, and user content.",
    suggestedAgents: ["drafter", "ideator"],
    categories: [
      { slug: "product-launches", name: "Product launches", color: SIG.coral, icon: "rocket", defaultPostType: "carousel" },
      { slug: "ugc", name: "Customer content", color: SIG.peach, icon: "heart", defaultPostType: "reel" },
      { slug: "promotions", name: "Promotions", color: SIG.yellow, icon: "tag", defaultPostType: "grid" },
      { slug: "lookbook", name: "Lookbook", color: SIG.violet, icon: "image", defaultPostType: "carousel" },
    ],
    templateSlugs: ["ecom-launch", "ecom-ugc-roundup"],
    toneHint: "Vibrant, visual, on-trend.",
  },
  saas: {
    label: "SaaS / software product",
    description: "Feature launches, customer stories, technical content.",
    suggestedAgents: ["drafter", "ideator", "cadence-planner"],
    categories: [
      { slug: "feature-launches", name: "Feature launches", color: SIG.violet, icon: "sparkles", defaultPostType: "carousel" },
      { slug: "customer-stories", name: "Customer stories", color: SIG.emerald, icon: "quote", defaultPostType: "carousel" },
      { slug: "tutorials", name: "Tutorials", color: SIG.coral, icon: "graduation-cap", defaultPostType: "carousel" },
      { slug: "industry-insights", name: "Industry insights", color: SIG.forest, icon: "trending-up", defaultPostType: "grid" },
    ],
    templateSlugs: ["saas-feature-launch", "saas-tutorial"],
    toneHint: "Helpful, technical, slightly playful.",
  },
  nonprofit: {
    label: "Nonprofit / cause",
    description: "Mission stories, calls to action, awareness moments.",
    suggestedAgents: ["drafter", "awareness-researcher", "ideator"],
    categories: [
      { slug: "mission", name: "Mission stories", color: SIG.coral, icon: "heart", defaultPostType: "carousel" },
      { slug: "campaigns", name: "Campaigns", color: SIG.violet, icon: "megaphone", defaultPostType: "grid" },
      { slug: "awareness", name: "Awareness days", color: SIG.yellow, icon: "calendar-days", defaultPostType: "grid" },
      { slug: "volunteer-stories", name: "Volunteer stories", color: SIG.emerald, icon: "users", defaultPostType: "carousel" },
    ],
    templateSlugs: ["nonprofit-campaign", "nonprofit-awareness-day"],
    toneHint: "Empathetic, urgent, hopeful.",
  },
  creator: {
    label: "Creator / personal brand",
    description: "Daily-cadence content focused on one voice.",
    suggestedAgents: ["drafter", "ideator"],
    categories: [
      { slug: "daily-thoughts", name: "Daily thoughts", color: SIG.peach, icon: "message-circle", defaultPostType: "grid" },
      { slug: "tutorials", name: "Tutorials", color: SIG.coral, icon: "graduation-cap", defaultPostType: "reel" },
      { slug: "behind-the-scenes", name: "Behind the scenes", color: SIG.violet, icon: "camera", defaultPostType: "story" },
      { slug: "collabs", name: "Collabs", color: SIG.emerald, icon: "handshake", defaultPostType: "carousel" },
    ],
    templateSlugs: ["creator-daily", "creator-tutorial-reel"],
    toneHint: "Personal, candid, conversational.",
  },
  "local-business": {
    label: "Local / hospitality",
    description: "Foot-traffic posts: menus, hours, events, neighborhood.",
    suggestedAgents: ["drafter", "cadence-planner"],
    categories: [
      { slug: "menu-specials", name: "Menu & specials", color: SIG.coral, icon: "utensils", defaultPostType: "grid" },
      { slug: "events", name: "Events", color: SIG.violet, icon: "calendar", defaultPostType: "grid" },
      { slug: "community", name: "Community", color: SIG.emerald, icon: "map-pin", defaultPostType: "carousel" },
      { slug: "behind-the-scenes", name: "Behind the scenes", color: SIG.peach, icon: "camera", defaultPostType: "story" },
    ],
    templateSlugs: ["local-event", "local-menu-special"],
    toneHint: "Friendly, neighborhood, welcoming.",
  },
  other: GENERIC_DEFAULTS,
}

export function getIndustryDefaults(industry: string | undefined): IndustryDefaults {
  if (!industry) return GENERIC_DEFAULTS
  return INDUSTRY_DEFAULTS[industry as IndustryId] ?? GENERIC_DEFAULTS
}

export function listIndustries(): { id: IndustryId; label: string }[] {
  return (Object.keys(INDUSTRY_DEFAULTS) as IndustryId[]).map((id) => ({
    id,
    label: INDUSTRY_DEFAULTS[id].label,
  }))
}
