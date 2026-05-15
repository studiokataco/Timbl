import type { NextConfig } from "next"

/*
 * The agent runtime depends on heavy Node-only packages: ADK pulls in the
 * full Google Cloud + Vertex + OpenTelemetry tree, firebase-admin uses
 * node:net / node:tls / etc, and the Anthropic SDK shims Node streams.
 * Marking them as server-external keeps Next from trying to bundle them
 * into the client or edge runtime — and prevents the "Module not found:
 * Can't resolve 'fs'" class of failures when an agent module is reachable
 * through a server import graph.
 */
const nextConfig: NextConfig = {
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
