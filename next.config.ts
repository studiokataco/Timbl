import type { NextConfig } from "next"

/*
 * The agent runtime depends on heavy Node-only packages: ADK pulls in the
 * full Google Cloud + Vertex + OpenTelemetry tree, firebase-admin uses
 * node:net / node:tls / etc, and the Anthropic SDK shims Node streams.
 * Marking them as server-external keeps Next from trying to bundle them
 * into the client or edge runtime - and prevents the "Module not found:
 * Can't resolve 'fs'" class of failures when an agent module is reachable
 * through a server import graph.
 */
const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const authProxyHost =
  process.env.FIREBASE_AUTH_PROXY_HOST ??
  (firebaseProjectId ? `${firebaseProjectId}.firebaseapp.com` : null)

const nextConfig: NextConfig = {
  async rewrites() {
    if (process.env.NEXT_PUBLIC_USE_EMULATORS === "1" || !authProxyHost) {
      return []
    }
    const base = `https://${authProxyHost}`
    return [
      { source: "/__/auth/:path*", destination: `${base}/__/auth/:path*` },
      { source: "/__/firebase/:path*", destination: `${base}/__/firebase/:path*` },
    ]
  },
  serverExternalPackages: [
    "@google/adk",
    "@google/genai",
    "@google-cloud/vertexai",
    "@google-cloud/storage",
    "@anthropic-ai/sdk",
    "firebase-admin",
    "winston",
    "@mikro-orm/core",
    "node-cron",
  ],
}

export default nextConfig
