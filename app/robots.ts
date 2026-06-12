import type { MetadataRoute } from "next"

import { siteUrl } from "@/lib/seo"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/signup"],
      disallow: [
        "/calendar",
        "/posts",
        "/kanban",
        "/campaigns",
        "/templates",
        "/studio",
        "/awareness",
        "/settings",
        "/workspaces",
        "/access-pending",
        "/onboarding",
        "/welcome",
        "/control",
        "/api",
        "/auth",
        "/suspended",
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
