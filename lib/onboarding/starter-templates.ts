/*
 * Curated starter templates. Used by the wizard's step 4 to write
 * actual /organizations/{orgId}/templates rows when the user accepts the
 * suggested set.
 *
 * Slugs match `templateSlugs` in industry-defaults.ts. The wizard reads
 * industry → slugs → looks up the row here → writes the row to Firestore.
 *
 * Why starter templates here vs. seed: seeds populate the SAFE demo org once at
 * dev-boot. The wizard runs on every NEW org and needs a curated source
 * accessible from server actions. Keeping it as code (not Firestore) means
 * adding a new industry's starter template is a code change, reviewable in
 * a PR.
 *
 * categoryId left blank - the wizard step 3 just created the org's
 * categories from industry-defaults.ts, but the user might have deselected
 * some. resolveCategoryForTemplate (in lib/actions/onboarding.ts) maps
 * slug → an actually-present category at apply time.
 */

export type TemplateCadence =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "ad-hoc"

export type StarterTemplate = {
  slug: string
  name: string
  /* Hint for the category the template *typically* belongs in - used by
   * the wizard to find a present category for the user's org. Falls back
   * to the first available category if no match. */
  preferredCategorySlug: string
  defaultPostType: "grid" | "carousel" | "reel" | "story" | "video"
  defaultHashtags: string[]
  blurbTemplate?: string
  cadence: TemplateCadence
}

export const STARTER_TEMPLATES: Record<string, StarterTemplate> = {
  /* Generic - used by GENERIC_DEFAULTS / "other" industry. */
  "generic-announcement": {
    slug: "generic-announcement",
    name: "Announcement",
    preferredCategorySlug: "announcements",
    defaultPostType: "grid",
    defaultHashtags: ["#News", "#Update"],
    blurbTemplate:
      "{{headline}}\n\n{{body}}\n\n- Tap the link in bio to learn more.",
    cadence: "ad-hoc",
  },
  "generic-tip-carousel": {
    slug: "generic-tip-carousel",
    name: "Tip carousel",
    preferredCategorySlug: "tips-howto",
    defaultPostType: "carousel",
    defaultHashtags: ["#Tips", "#HowTo"],
    blurbTemplate:
      "{{topic}} - {{numberOfTips}} things we wish we'd known sooner.\n\nSwipe through for the full list.",
    cadence: "weekly",
  },

  /* Agency. */
  "agency-case-study": {
    slug: "agency-case-study",
    name: "Case study",
    preferredCategorySlug: "case-studies",
    defaultPostType: "carousel",
    defaultHashtags: ["#CaseStudy", "#ClientWork"],
    blurbTemplate:
      "How we helped {{clientName}} {{outcome}}.\n\nSwipe through for the full story - link in bio for the deep dive.",
    cadence: "monthly",
  },
  "agency-client-win": {
    slug: "agency-client-win",
    name: "Client win",
    preferredCategorySlug: "client-wins",
    defaultPostType: "grid",
    defaultHashtags: ["#ClientWin", "#Proud"],
    blurbTemplate:
      "Big day for {{clientName}}: {{achievement}} 🎉\n\nProud to play a small part in this one.",
    cadence: "biweekly",
  },

  /* E-commerce. */
  "ecom-launch": {
    slug: "ecom-launch",
    name: "Product launch",
    preferredCategorySlug: "product-launches",
    defaultPostType: "carousel",
    defaultHashtags: ["#NewArrival", "#JustDropped"],
    blurbTemplate:
      "Meet {{productName}} - {{tagline}}.\n\nAvailable now: {{link}}",
    cadence: "ad-hoc",
  },
  "ecom-ugc-roundup": {
    slug: "ecom-ugc-roundup",
    name: "Customer content roundup",
    preferredCategorySlug: "ugc",
    defaultPostType: "carousel",
    defaultHashtags: ["#Community", "#YourStyle"],
    blurbTemplate:
      "Our favourite {{productName}} looks from you this month 💛\n\nKeep tagging us - we love seeing them.",
    cadence: "monthly",
  },

  /* SaaS. */
  "saas-feature-launch": {
    slug: "saas-feature-launch",
    name: "Feature launch",
    preferredCategorySlug: "feature-launches",
    defaultPostType: "carousel",
    defaultHashtags: ["#NewFeature", "#ProductUpdate"],
    blurbTemplate:
      "New in {{productName}}: {{featureName}}.\n\n{{oneLineBenefit}}\n\nTry it now → {{link}}",
    cadence: "ad-hoc",
  },
  "saas-tutorial": {
    slug: "saas-tutorial",
    name: "Tutorial",
    preferredCategorySlug: "tutorials",
    defaultPostType: "carousel",
    defaultHashtags: ["#Tutorial", "#HowTo", "#ProductTip"],
    blurbTemplate:
      "How to {{task}} in {{productName}} - in {{numberOfSteps}} steps.\n\nSwipe through, save for later.",
    cadence: "biweekly",
  },

  /* Nonprofit. */
  "nonprofit-campaign": {
    slug: "nonprofit-campaign",
    name: "Campaign update",
    preferredCategorySlug: "campaigns",
    defaultPostType: "grid",
    defaultHashtags: ["#Campaign", "#MakeADifference"],
    blurbTemplate:
      "{{campaignName}} - we're {{percentOfGoal}}% of the way there.\n\nEvery share helps. Link in bio to donate.",
    cadence: "weekly",
  },
  "nonprofit-awareness-day": {
    slug: "nonprofit-awareness-day",
    name: "Awareness day",
    preferredCategorySlug: "awareness",
    defaultPostType: "grid",
    defaultHashtags: ["#AwarenessDay", "#ChangeTheNarrative"],
    blurbTemplate:
      "Today is {{awarenessDay}}.\n\n{{factOrCallToAction}}\n\nWhat's one thing you'll do today?",
    cadence: "ad-hoc",
  },

  /* Creator. */
  "creator-daily": {
    slug: "creator-daily",
    name: "Daily thought",
    preferredCategorySlug: "daily-thoughts",
    defaultPostType: "grid",
    defaultHashtags: ["#Thoughts"],
    blurbTemplate: "{{thought}}\n\n- What's on your mind today?",
    cadence: "weekly",
  },
  "creator-tutorial-reel": {
    slug: "creator-tutorial-reel",
    name: "Tutorial reel",
    preferredCategorySlug: "tutorials",
    defaultPostType: "reel",
    defaultHashtags: ["#Tutorial", "#HowTo"],
    blurbTemplate: "How to {{task}} - in 30 seconds.\n\nSave this for later 🔖",
    cadence: "biweekly",
  },

  /* Local. */
  "local-event": {
    slug: "local-event",
    name: "Event announcement",
    preferredCategorySlug: "events",
    defaultPostType: "grid",
    defaultHashtags: ["#LocalEvent", "#ComeJoinUs"],
    blurbTemplate:
      "{{eventName}} - {{date}} at {{location}}.\n\n{{oneLineHook}}\n\nSee you there 🎉",
    cadence: "ad-hoc",
  },
  "local-menu-special": {
    slug: "local-menu-special",
    name: "Menu special",
    preferredCategorySlug: "menu-specials",
    defaultPostType: "grid",
    defaultHashtags: ["#Special", "#TodayOnly"],
    blurbTemplate: "Today's special: {{dish}}.\n\n{{description}}",
    cadence: "weekly",
  },
}

export function getStarterTemplate(slug: string): StarterTemplate | undefined {
  return STARTER_TEMPLATES[slug]
}
