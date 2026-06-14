import { siteUrl } from "@/lib/seo"

export const dynamic = "force-dynamic"

/*
 * OAuth 2.0 Protected Resource Metadata (RFC 9728 / MCP 2025-06).
 * Points MCP clients at the authorization server for token acquisition.
 */
export function GET() {
  const base = siteUrl()
  return Response.json(
    {
      resource: `${base}/api/mcp`,
      authorization_servers: [`${base}`],
      bearer_methods_supported: ["header"],
      resource_documentation: `${base}/api/public/v1/openapi.json`,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    },
  )
}
