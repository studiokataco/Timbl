# Timbl Public API

## Base URL

```
https://app.timbl.co
```

## Authentication

All requests require a `Bearer` token in the `Authorization` header.

| Token prefix | Source | Notes |
|---|---|---|
| `tmbl_pk_*` | Settings > Integrations | API key scoped at creation time |
| `tmbl_at_*` | OAuth 2.1 authorization code flow | User-delegated, expires per TTL |

```http
Authorization: Bearer tmbl_pk_<your-key>
```

## Request format

Every endpoint shares a single route shape:

```
POST /api/public/v1/{resource}
Content-Type: application/json

{ "verb": "<verb>", ...args }
```

`resource` selects the domain; `verb` selects the operation within it.

---

## Resources

### posts

**Scopes:** `posts:read`, `posts:write`, `posts:publish`

| verb | Required scopes | Body fields | Response |
|---|---|---|---|
| `list` | `posts:read` | `start?` (ISO date), `end?`, `status?`, `limit?` (default 50) | `{ posts: Post[] }` |
| `get` | `posts:read` | `id` | `{ post: Post }` |
| `create` | `posts:write` | `scheduledDate` (ISO date), any Post field | `{ post: Post }` 201 |
| `update` | `posts:write` | `id`, any Post field | `{ ok: true }` |
| `edit` | `posts:write` | `id`, any Post field (only on draft/scheduled posts) | `{ ok: true }` |
| `delete` | `posts:write` | `id` | `{ ok: true }` |
| `schedule` | `posts:write` | `id`, `scheduledDate?`, `scheduledTime?` | `{ ok: true }` |
| `unschedule` | `posts:write` | `id` | `{ ok: true }` |
| `publish_now` | `posts:publish` | `id` | `{ ok: true }` |

**Post object**

```json
{
  "id": "string",
  "organizationId": "string",
  "brief": "string",
  "detailedBrief": "string",
  "status": "idea | draft | scheduled | posted | failed",
  "scheduledDate": "YYYY-MM-DD",
  "scheduledTime": "HH:MM",
  "hashtags": ["string"],
  "assetUrls": ["string"],
  "channelStatuses": { "channelId": "pending | posted | failed" },
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601"
}
```

---

### ideation

**Scopes:** `ideation:read`, `ideation:write`

| verb | Required scopes | Body fields | Response |
|---|---|---|---|
| `list` | `ideation:read` | `status?`, `limit?` (default 50) | `{ items: IdeationItem[] }` |
| `create` | `ideation:write` | `title` (required), `summary?`, `tags?` | `{ item: IdeationItem }` 201 |
| `promote` | `ideation:write` | `id`, `scheduledDate?` | `{ postId: string }` |

`promote` converts an ideation item into a draft post and links the two documents.

---

### approvals

**Scopes:** `approvals:read`, `approvals:request`

| verb | Required scopes | Body fields | Response |
|---|---|---|---|
| `list` | `approvals:read` | - | `{ items: Post[] }` - posts with `reviewState: "pending"` |
| `request` | `approvals:request` | `postId` | `{ ok: true }` |
| `decide` | `approvals:request` | `postId`, `approved` (boolean), `feedback?` | `{ ok: true }` |

---

### categories

**Scopes:** `categories:read`

| verb | Required scopes | Body fields | Response |
|---|---|---|---|
| `list` | `categories:read` | - | `{ categories: Category[] }` |

Returns only active categories, ordered by `displayOrder`.

---

### channels

**Scopes:** `channels:read`

| verb | Required scopes | Body fields | Response |
|---|---|---|---|
| `list` | `channels:read` | - | `{ channels: Channel[] }` |
| `get` | `channels:read` | `id` | `{ channel: Channel }` |

Returns channels with status `active` or `needs_reauth`.

---

### metrics

**Scopes:** `metrics:read`

| verb | Required scopes | Body fields | Response |
|---|---|---|---|
| `window` | `metrics:read` | `start` (ISO 8601), `end` (ISO 8601) | `{ total, successful, failed, runs: Run[] }` |

---

### webhooks

**Scopes:** `webhooks:write`

| verb | Required scopes | Body fields | Response |
|---|---|---|---|
| `subscribe` | `webhooks:write` | `url` (HTTPS), `events` (string[]) | `{ subscriptionId, secret }` 201 |
| `list` | `webhooks:write` | - | `{ subscriptions: Subscription[] }` |

`secret` is returned only on creation. Store it securely - it is used to verify delivery signatures.

---

## Rate limits

| Tier | Requests/min | Requests/day |
|---|---|---|
| free | 300 | 10,000 |
| agency | 1,200 | 100,000 |
| operator | unlimited | unlimited |

Tier is set per API key in the Timbl dashboard. When a limit is reached the API returns:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42
```

```json
{ "error": { "code": "rate_limited", "message": "rate limited" } }
```

---

## Errors

All error responses share this shape:

```json
{
  "error": {
    "code": "snake_case_code",
    "message": "human readable",
    "details": "optional extra context"
  }
}
```

| HTTP status | code | Meaning |
|---|---|---|
| 400 | `invalid_json` | Request body is not valid JSON |
| 400 | `missing_verb` | `verb` field absent or empty |
| 400 | `invalid_body` | Schema validation failed |
| 400 | `invalid_id` | `id` field absent or empty |
| 401 | `missing_token` | No `Authorization` header |
| 401 | `invalid_token` | Token not found or revoked |
| 403 | `insufficient_scope` | Token lacks required scope |
| 404 | `unknown_resource` | `{resource}` path segment not recognised |
| 404 | `unknown_verb` | `verb` not recognised for this resource |
| 404 | `not_found` | Document with given `id` does not exist |
| 409 | `invalid_state` | Operation not allowed in the document's current state |
| 429 | `rate_limited` | Rate limit exceeded |
| 500 | `internal_error` | Unexpected server error |

---

## Webhooks

When an event fires, Timbl sends a `POST` to your subscription URL with:

```http
Content-Type: application/json
X-Timbl-Signature: sha256=<hex-digest>
X-Timbl-Event: <event-name>
```

Verify the signature before trusting the payload:

```ts
import { createHmac, timingSafeEqual } from "node:crypto"

function verify(secret: string, rawBody: Buffer, sigHeader: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
  const received = sigHeader.replace("sha256=", "")
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received))
}
```

**Event names** follow the pattern `{resource}.{verb}` (e.g. `posts.create`, `posts.publish_now`).
