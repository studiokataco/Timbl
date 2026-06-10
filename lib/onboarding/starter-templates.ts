/*
 * Curated starter templates. Used by the wizard's step 4 to write
 * actual /organizations/{orgId}/templates rows when the user accepts the
 * suggested set.
 *
 * Slugs match `templateSlugs` in industry-defaults.ts. The wizard reads
 * industry → slugs → looks up the row here → writes the row to Firestore.
 *
 * Why starter templates here vs. seed: seeds populate the Timbl demo org
 * once at dev-boot. The wizard runs on every NEW org and needs a curated
 * source accessible from server actions. Keeping it as code (not
 * Firestore) means adding a new industry's starter template is a code
 * change, reviewable in a PR.
 *
 * categoryId left blank - the wizard step 3 just created the org's
 * categories from industry-defaults.ts, but the user might have deselected
 * some. resolveCategoryForTemplate (in lib/actions/onboarding.ts) maps
 * slug → an actually-present category at apply time.
 *
 * Content rules:
 *   - Sentence case names.
 *   - ASCII hyphens only. No emojis.
 *   - Blurbs use {{placeholder}} tokens so the drafter knows what to fill.
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
  "generic-weekly-recap": {
    slug: "generic-weekly-recap",
    name: "Weekly recap",
    preferredCategorySlug: "announcements",
    defaultPostType: "carousel",
    defaultHashtags: ["#WeeklyRecap"],
    blurbTemplate:
      "Five things from the week of {{weekStart}}:\n\n1. {{itemOne}}\n2. {{itemTwo}}\n3. {{itemThree}}\n4. {{itemFour}}\n5. {{itemFive}}",
    cadence: "weekly",
  },
  "generic-quote-card": {
    slug: "generic-quote-card",
    name: "Quote card",
    preferredCategorySlug: "announcements",
    defaultPostType: "grid",
    defaultHashtags: ["#Quote"],
    blurbTemplate:
      "\"{{quote}}\"\n\n- {{attribution}}\n\nWhat does this mean to you?",
    cadence: "biweekly",
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
    defaultHashtags: ["#ClientWin"],
    blurbTemplate:
      "Big day for {{clientName}}: {{achievement}}.\n\nProud to play a part in this one.",
    cadence: "biweekly",
  },
  "agency-founder-story": {
    slug: "agency-founder-story",
    name: "Founder story",
    preferredCategorySlug: "team-culture",
    defaultPostType: "carousel",
    defaultHashtags: ["#FounderStory", "#BehindTheScenes"],
    blurbTemplate:
      "Meet {{founderName}}, who started {{companyName}} after {{origin}}.\n\nHere's what they've learned along the way.",
    cadence: "monthly",
  },
  "agency-hiring-spotlight": {
    slug: "agency-hiring-spotlight",
    name: "Hiring spotlight",
    preferredCategorySlug: "team-culture",
    defaultPostType: "grid",
    defaultHashtags: ["#Hiring", "#WeAreHiring"],
    blurbTemplate:
      "We're hiring a {{roleName}}.\n\n{{oneLineHook}}\n\nApply or refer someone - link in bio.",
    cadence: "ad-hoc",
  },
  "agency-process-teardown": {
    slug: "agency-process-teardown",
    name: "Process teardown",
    preferredCategorySlug: "thought-leadership",
    defaultPostType: "carousel",
    defaultHashtags: ["#ProcessTeardown", "#HowWeWork"],
    blurbTemplate:
      "How we approached {{projectType}} for {{clientName}}.\n\n{{numberOfSteps}} steps from brief to launch - swipe through.",
    cadence: "monthly",
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
      "Our favourite {{productName}} looks from you this month.\n\nKeep tagging us - we love seeing them.",
    cadence: "monthly",
  },
  "ecom-restock-alert": {
    slug: "ecom-restock-alert",
    name: "Restock alert",
    preferredCategorySlug: "product-launches",
    defaultPostType: "grid",
    defaultHashtags: ["#BackInStock"],
    blurbTemplate:
      "Back in stock: {{productName}}.\n\nWent fast last time - link in bio if you want one.",
    cadence: "ad-hoc",
  },
  "ecom-education-tip": {
    slug: "ecom-education-tip",
    name: "Education tip",
    preferredCategorySlug: "tips-howto",
    defaultPostType: "carousel",
    defaultHashtags: ["#Tips", "#KnowYourGear"],
    blurbTemplate:
      "How to {{task}} with {{productName}}.\n\nSwipe through - save for later.",
    cadence: "weekly",
  },
  "ecom-behind-the-product": {
    slug: "ecom-behind-the-product",
    name: "Behind the product",
    preferredCategorySlug: "behind-the-scenes",
    defaultPostType: "reel",
    defaultHashtags: ["#BehindTheScenes", "#HowItsMade"],
    blurbTemplate:
      "What goes into making {{productName}}.\n\nA peek behind the scenes from our {{teamOrLocation}}.",
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
      "New in {{productName}}: {{featureName}}.\n\n{{oneLineBenefit}}\n\nTry it now: {{link}}",
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
  "saas-customer-quote": {
    slug: "saas-customer-quote",
    name: "Customer quote",
    preferredCategorySlug: "case-studies",
    defaultPostType: "grid",
    defaultHashtags: ["#CustomerLove"],
    blurbTemplate:
      "\"{{quote}}\"\n\n- {{customerName}}, {{customerRole}} at {{customerCompany}}",
    cadence: "biweekly",
  },
  "saas-changelog-recap": {
    slug: "saas-changelog-recap",
    name: "Monthly changelog",
    preferredCategorySlug: "announcements",
    defaultPostType: "carousel",
    defaultHashtags: ["#ChangelogRecap", "#ProductUpdate"],
    blurbTemplate:
      "{{monthName}} in {{productName}} - the five things worth your time.\n\nSwipe through.",
    cadence: "monthly",
  },
  "saas-integration-spotlight": {
    slug: "saas-integration-spotlight",
    name: "Integration spotlight",
    preferredCategorySlug: "feature-launches",
    defaultPostType: "grid",
    defaultHashtags: ["#Integration"],
    blurbTemplate:
      "{{productName}} now talks to {{partnerName}}.\n\n{{oneLineUseCase}}",
    cadence: "ad-hoc",
  },

  /* Nonprofit. */
  "nonprofit-campaign": {
    slug: "nonprofit-campaign",
    name: "Campaign update",
    preferredCategorySlug: "campaigns",
    defaultPostType: "grid",
    defaultHashtags: ["#Campaign"],
    blurbTemplate:
      "{{campaignName}} - we're {{percentOfGoal}}% of the way there.\n\nEvery share helps. Link in bio to donate.",
    cadence: "weekly",
  },
  "nonprofit-awareness-day": {
    slug: "nonprofit-awareness-day",
    name: "Awareness day",
    preferredCategorySlug: "awareness",
    defaultPostType: "grid",
    defaultHashtags: ["#AwarenessDay"],
    blurbTemplate:
      "Today is {{awarenessDay}}.\n\n{{factOrCallToAction}}\n\nWhat's one thing you'll do today?",
    cadence: "ad-hoc",
  },
  "nonprofit-donor-impact": {
    slug: "nonprofit-donor-impact",
    name: "Donor impact",
    preferredCategorySlug: "campaigns",
    defaultPostType: "carousel",
    defaultHashtags: ["#DonorImpact", "#ThankYou"],
    blurbTemplate:
      "Because of {{donorOrCommunity}}, we were able to {{outcome}}.\n\nThank you for showing up.",
    cadence: "monthly",
  },
  "nonprofit-volunteer-spotlight": {
    slug: "nonprofit-volunteer-spotlight",
    name: "Volunteer spotlight",
    preferredCategorySlug: "team-culture",
    defaultPostType: "grid",
    defaultHashtags: ["#VolunteerSpotlight"],
    blurbTemplate:
      "Meet {{volunteerName}}, who has been with us for {{timeSpan}}.\n\n{{whyTheyShowUp}}",
    cadence: "biweekly",
  },
  "nonprofit-mission-story": {
    slug: "nonprofit-mission-story",
    name: "Mission story",
    preferredCategorySlug: "thought-leadership",
    defaultPostType: "carousel",
    defaultHashtags: ["#OurMission"],
    blurbTemplate:
      "Why {{causeOrProgram}} matters.\n\nA short story about {{personOrCommunity}} and what changed for them.",
    cadence: "monthly",
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
    blurbTemplate: "How to {{task}} - in 30 seconds.\n\nSave this for later.",
    cadence: "biweekly",
  },
  "creator-weekly-recap": {
    slug: "creator-weekly-recap",
    name: "Weekly recap",
    preferredCategorySlug: "daily-thoughts",
    defaultPostType: "carousel",
    defaultHashtags: ["#WeeklyRecap"],
    blurbTemplate:
      "Five things from this week:\n\n1. {{itemOne}}\n2. {{itemTwo}}\n3. {{itemThree}}\n4. {{itemFour}}\n5. {{itemFive}}",
    cadence: "weekly",
  },
  "creator-ama": {
    slug: "creator-ama",
    name: "AMA prompt",
    preferredCategorySlug: "daily-thoughts",
    defaultPostType: "story",
    defaultHashtags: ["#AMA"],
    blurbTemplate:
      "Ask me anything about {{topic}}.\n\nDrop your questions and I'll answer this week.",
    cadence: "biweekly",
  },
  "creator-audience-question": {
    slug: "creator-audience-question",
    name: "Audience question",
    preferredCategorySlug: "daily-thoughts",
    defaultPostType: "grid",
    defaultHashtags: ["#TellMeMore"],
    blurbTemplate:
      "Quick question for you: {{question}}\n\nDrop your answer in the replies.",
    cadence: "weekly",
  },

  /* Local. */
  "local-event": {
    slug: "local-event",
    name: "Event announcement",
    preferredCategorySlug: "events",
    defaultPostType: "grid",
    defaultHashtags: ["#LocalEvent"],
    blurbTemplate:
      "{{eventName}} - {{date}} at {{location}}.\n\n{{oneLineHook}}\n\nSee you there.",
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
  "local-weekly-hours": {
    slug: "local-weekly-hours",
    name: "Weekly hours",
    preferredCategorySlug: "announcements",
    defaultPostType: "story",
    defaultHashtags: ["#OpenThisWeek"],
    blurbTemplate:
      "Hours this week:\n{{weekHours}}\n\n{{noteOnHoliday}}",
    cadence: "weekly",
  },
  "local-customer-spotlight": {
    slug: "local-customer-spotlight",
    name: "Customer spotlight",
    preferredCategorySlug: "behind-the-scenes",
    defaultPostType: "grid",
    defaultHashtags: ["#Regulars"],
    blurbTemplate:
      "Spot the regular: {{customerName}}.\n\n{{shortStory}}",
    cadence: "biweekly",
  },
  "local-behind-the-counter": {
    slug: "local-behind-the-counter",
    name: "Behind the counter",
    preferredCategorySlug: "behind-the-scenes",
    defaultPostType: "reel",
    defaultHashtags: ["#BehindTheCounter"],
    blurbTemplate:
      "A look behind the counter at {{businessName}}.\n\n{{oneLineHook}}",
    cadence: "monthly",
  },
}

export function getStarterTemplate(slug: string): StarterTemplate | undefined {
  return STARTER_TEMPLATES[slug]
}
