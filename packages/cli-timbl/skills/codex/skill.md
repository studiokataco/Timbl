# Timbl CLI

Manages Timbl posts, ideation, approvals, channels, categories, metrics, and webhooks via the Timbl public API.

## Setup

```bash
timbl init                   # enter API key + base URL
timbl install --codex        # install this skill
```

Config stored at `~/.config/timbl/config.json`.

## Posts

```bash
timbl posts list [--start <date>] [--end <date>] [--status <status>] [--limit <n>]
timbl posts get <id>
timbl posts create --scheduled-date <date> [--brief <text>]
timbl posts update <id> [--brief <text>] [--status <status>] [--scheduled-date <date>]
timbl posts schedule <id> [--scheduled-date <date>]
timbl posts unschedule <id>
timbl posts publish-now <id>
timbl posts delete <id>
```

## Ideation

```bash
timbl ideation list [--status <status>] [--limit <n>]
timbl ideation create --title <title>
timbl ideation promote <id> [--scheduled-date <date>]
```

## Approvals

```bash
timbl approvals list
timbl approvals request --post-id <id>
timbl approvals decide --post-id <id> --approved|--rejected [--feedback <text>]
```

## Other

```bash
timbl categories list
timbl channels list
timbl channels get <id>
timbl metrics window --start <date> --end <date>
timbl webhooks subscribe --url <url> --events <e1,e2,...>
timbl webhooks list
```

## Errors

- Config missing: run `timbl init`
- Auth failure: regenerate API key in Timbl settings
- Rate limit: respect `Retry-After` header
- All errors print `error.code` from the API to stderr
