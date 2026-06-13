import type { NextRequest } from "next/server"
import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi"
import { z } from "zod"
import { postSchema } from "@/lib/schemas/post"
import { ideationItemSchema } from "@/lib/schemas/ideationItem"

export const runtime = "nodejs"
export const dynamic = "force-static"

function buildSpec(base: string) {
  const registry = new OpenAPIRegistry()

  registry.registerComponent("securitySchemes", "BearerAuth", {
    type: "http",
    scheme: "bearer",
    description: "API key (tmbl_pk_...) or OAuth 2.1 access token (tmbl_at_...)",
  })

  const rpcBody = (resource: string, verb: string, extra: z.ZodRawShape = {}) =>
    z.object({ verb: z.literal(verb), ...extra }).describe(`${resource}.${verb}`)

  const verbs: Array<{ resource: string; verb: string; schema: z.ZodTypeAny; status?: number }> = [
    { resource: "posts", verb: "list", schema: rpcBody("posts", "list", { start: z.string().optional(), end: z.string().optional(), status: z.string().optional(), limit: z.number().optional() }) },
    { resource: "posts", verb: "get", schema: rpcBody("posts", "get", { id: z.string() }) },
    { resource: "posts", verb: "create", schema: rpcBody("posts", "create", { scheduledDate: z.string() }), status: 201 },
    { resource: "posts", verb: "update", schema: rpcBody("posts", "update", { id: z.string() }) },
    { resource: "posts", verb: "edit", schema: rpcBody("posts", "edit", { id: z.string() }) },
    { resource: "posts", verb: "delete", schema: rpcBody("posts", "delete", { id: z.string() }) },
    { resource: "posts", verb: "schedule", schema: rpcBody("posts", "schedule", { id: z.string(), scheduledDate: z.string().optional() }) },
    { resource: "posts", verb: "unschedule", schema: rpcBody("posts", "unschedule", { id: z.string() }) },
    { resource: "posts", verb: "publish_now", schema: rpcBody("posts", "publish_now", { id: z.string() }) },
    { resource: "ideation", verb: "list", schema: rpcBody("ideation", "list", { status: z.string().optional(), limit: z.number().optional() }) },
    { resource: "ideation", verb: "create", schema: rpcBody("ideation", "create", { title: z.string() }), status: 201 },
    { resource: "ideation", verb: "promote", schema: rpcBody("ideation", "promote", { id: z.string(), scheduledDate: z.string().optional() }) },
    { resource: "approvals", verb: "list", schema: rpcBody("approvals", "list") },
    { resource: "approvals", verb: "request", schema: rpcBody("approvals", "request", { postId: z.string() }) },
    { resource: "approvals", verb: "decide", schema: rpcBody("approvals", "decide", { postId: z.string(), approved: z.boolean(), feedback: z.string().optional() }) },
    { resource: "categories", verb: "list", schema: rpcBody("categories", "list") },
    { resource: "channels", verb: "list", schema: rpcBody("channels", "list") },
    { resource: "channels", verb: "get", schema: rpcBody("channels", "get", { id: z.string() }) },
    { resource: "metrics", verb: "window", schema: rpcBody("metrics", "window", { start: z.string(), end: z.string() }) },
    { resource: "webhooks", verb: "subscribe", schema: rpcBody("webhooks", "subscribe", { url: z.string().url(), events: z.array(z.string()) }), status: 201 },
    { resource: "webhooks", verb: "list", schema: rpcBody("webhooks", "list") },
  ]

  for (const { resource, verb, schema, status = 200 } of verbs) {
    registry.registerPath({
      method: "post",
      path: `/api/public/v1/${resource}`,
      summary: `${resource}.${verb}`,
      security: [{ BearerAuth: [] }],
      request: { body: { content: { "application/json": { schema } } } },
      responses: {
        [status]: { description: "Success", content: { "application/json": { schema: z.object({ ok: z.boolean().optional() }) } } },
        401: { description: "Unauthorized" },
        403: { description: "Insufficient scope" },
        404: { description: "Not found" },
      },
    })
  }

  void postSchema
  void ideationItemSchema

  const generator = new OpenApiGeneratorV31(registry.definitions)
  return generator.generateDocument({
    openapi: "3.1.0",
    info: { title: "Timbl Public API", version: "v1" },
    servers: [{ url: base, description: "This server" }],
  })
}

export function GET(req: NextRequest) {
  const base = new URL(req.url).origin
  const spec = buildSpec(base)
  return Response.json(spec, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  })
}
