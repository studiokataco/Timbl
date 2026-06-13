# Timbl CLI skill

## Overview

The `timbl` CLI manages Timbl posts, ideation items, approvals, channels, categories, metrics, and webhooks through the Timbl public REST API. Use it whenever the user asks to create, list, update, schedule, or approve social media content inside Timbl.

## Setup

1. Run `timbl init` - prompts for API key and base URL, writes `~/.config/timbl/config.json`.
2. Run `timbl install --claude-code` - copies this skill to `~/.claude/skills/timbl/SKILL.md`.

## Key commands

### Posts

```bash
timbl posts list --start 2025-01-01 --end 2025-01-31 --status draft --limit 20
timbl posts get <id>
timbl posts create --scheduled-date 2025-06-20 --brief "Product launch thread"
timbl posts update <id> --status ready --brief "Updated brief"
timbl posts schedule <id> --scheduled-date 2025-06-20T10:00:00Z
timbl posts unschedule <id>
timbl posts publish-now <id>
timbl posts delete <id>
```

### Ideation

```bash
timbl ideation list --status open --limit 10
timbl ideation create --title "Summer campaign ideas"
timbl ideation promote <id> --scheduled-date 2025-07-01
```

### Approvals

```bash
timbl approvals list
timbl approvals request --post-id <id>
timbl approvals decide --post-id <id> --approved
timbl approvals decide --post-id <id> --rejected --feedback "Needs brand voice update"
```

### Other resources

```bash
timbl categories list
timbl channels list
timbl channels get <id>
timbl metrics window --start 2025-01-01 --end 2025-01-31
timbl webhooks subscribe --url https://example.com/hook --events post.published,post.approved
timbl webhooks list
```

## Output

All commands print JSON to stdout. Pipe to `jq` for filtering:

```bash
timbl posts list --status draft | jq '.[].id'
```

## Error handling

- `Run 'timbl init' first` - config file missing; run `timbl init`.
- `401` / `UNAUTHORIZED` - API key invalid or revoked; generate a new key in Timbl settings.
- `429` / `RATE_LIMIT_EXCEEDED` - back off and retry after the `Retry-After` header value.
- Any other error code is surfaced directly from the API response `error.code` field.
