import { z } from "zod"

export const publicScopeSchema = z.enum([
  "posts:read",
  "posts:write",
  "posts:publish",
  "ideation:read",
  "ideation:write",
  "approvals:read",
  "approvals:request",
  "approvals:decide",
  "metrics:read",
  "channels:read",
  "categories:read",
  "webhooks:write",
  "inbox:read",
])

export type PublicScope = z.infer<typeof publicScopeSchema>

export class InsufficientScopeError extends Error {
  readonly required: PublicScope
  constructor(required: PublicScope) {
    super(`Insufficient scope: ${required} required`)
    this.name = "InsufficientScopeError"
    this.required = required
  }
}

export function requireScope(
  appScopes: PublicScope[],
  required: PublicScope,
): void {
  if (!appScopes.includes(required)) {
    throw new InsufficientScopeError(required)
  }
}
