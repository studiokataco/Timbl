import type { NextRequest } from "next/server"

export const dynamic = "force-static"

/*
 * OAuth 2.0 Authorization Server Metadata (RFC 8414).
 * Consumed by MCP clients during discovery.
 */
export function GET(req: NextRequest) {
  const base = new URL(req.url).origin
  return Response.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/api/oauth/token`,
      revocation_endpoint: `${base}/api/oauth/revoke`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: [
        "posts:read",
        "posts:write",
        "posts:publish",
        "ideation:read",
        "ideation:write",
        "approvals:read",
        "approvals:request",
        "metrics:read",
        "channels:read",
        "categories:read",
        "webhooks:write",
        "inbox:read",
      ],
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    },
  )
}
