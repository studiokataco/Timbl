import type { NextRequest } from "next/server"

import {
  resolvePublicCaller,
  type PublicCaller,
} from "@/lib/api/public-middleware"
import { writePublicAudit } from "@/lib/telemetry/public-audit"
import { getMcpTools, callMcpTool } from "@/lib/mcp/tools"
import { InsufficientScopeError } from "@/lib/auth/public-scopes"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version",
}

function jsonrpc(id: unknown, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result }, { headers: CORS })
}

function jsonrpcError(id: unknown, code: number, message: string) {
  return Response.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    { headers: CORS },
  )
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

export async function GET() {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("event: ping\ndata: {}\n\n"))
      controller.close()
    },
  })
  return new Response(stream, {
    headers: {
      ...CORS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  })
}

export async function POST(req: NextRequest) {
  let body: { jsonrpc?: string; method?: unknown; params?: unknown; id?: unknown }
  try {
    body = await req.json()
  } catch {
    return jsonrpcError(null, -32700, "Parse error")
  }

  const { method, params, id } = body

  if (method === "initialize") {
    return jsonrpc(id, {
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "timbl", version: "1" },
    })
  }

  if (method === "notifications/initialized") {
    return new Response(null, { status: 202, headers: CORS })
  }

  if (method === "tools/list") {
    return jsonrpc(id, { tools: getMcpTools() })
  }

  if (method === "tools/call") {
    const start = Date.now()
    const p = params as Record<string, unknown> | undefined
    const toolName = typeof p?.name === "string" ? p.name : undefined
    const toolArgs = p?.arguments ?? {}

    if (!toolName) {
      return jsonrpcError(id, -32602, "Invalid params: missing name")
    }

    const authResult = await resolvePublicCaller(req.headers.get("authorization"))
    if ("error" in authResult) {
      return jsonrpcError(id, -32001, authResult.error)
    }
    const caller: PublicCaller = authResult.caller

    let result: Record<string, unknown>
    let success = true
    let errorCode: string | undefined

    try {
      result = await callMcpTool(caller, toolName, toolArgs)
    } catch (err) {
      success = false
      if (err instanceof InsufficientScopeError) {
        errorCode = "insufficient_scope"
        void writePublicAudit({
          orgId: caller.orgId,
          kind: "mcp.tool_call",
          appId: caller.appId,
          subjectUserId: caller.subjectUserId,
          latencyMs: Date.now() - start,
          success: false,
          errorCode,
        })
        return jsonrpc(id, {
          content: [{ type: "text", text: JSON.stringify({ error: errorCode }) }],
          isError: true,
        })
      }
      const typedErr = err as Error & { code?: string }
      errorCode = typedErr.code ?? "internal_error"
      void writePublicAudit({
        orgId: caller.orgId,
        kind: "mcp.tool_call",
        appId: caller.appId,
        subjectUserId: caller.subjectUserId,
        latencyMs: Date.now() - start,
        success: false,
        errorCode,
      })
      return jsonrpc(id, {
        content: [{ type: "text", text: JSON.stringify({ error: errorCode, message: typedErr.message }) }],
        isError: true,
      })
    }

    void writePublicAudit({
      orgId: caller.orgId,
      kind: "mcp.tool_call",
      appId: caller.appId,
      subjectUserId: caller.subjectUserId,
      latencyMs: Date.now() - start,
      success,
      errorCode,
    })

    return jsonrpc(id, {
      content: [{ type: "text", text: JSON.stringify(result) }],
    })
  }

  return jsonrpcError(id, -32601, "Method not found")
}
