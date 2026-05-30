/*
 * Org-agnostic default CTAs. Seeded on bootstrap and onboarding so the
 * composer pickers work even when the SAFE-specific emulator seed hasn't run.
 */

export type DefaultCta = {
  slug: string
  label: string
  description?: string
}

export const DEFAULT_CTAS: DefaultCta[] = [
  { slug: "attend-an-event", label: "Attend an event" },
  { slug: "donate", label: "Donate" },
  { slug: "like", label: "Like" },
  {
    slug: "learn-more",
    label: "Learn more",
    description: "Educational call to action - invite the audience to read, watch, or change a habit.",
  },
  { slug: "visit-shop", label: "Visit shop" },
  { slug: "volunteer", label: "Volunteer" },
  { slug: "share", label: "Share" },
  { slug: "comment", label: "Comment" },
  { slug: "save", label: "Save" },
]
