"use client"

import { useState, useSyncExternalStore } from "react"
import { Eye, EyeOff } from "lucide-react"

import { ChoiceChips } from "@/components/shared/choice-chips"
import { CopyButton, CopyField } from "@/components/settings/integrations-bits"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const CLIENTS = [
  { key: "cursor", label: "Cursor" },
  { key: "claude-code", label: "Claude Code" },
  { key: "claude-desktop", label: "Claude Desktop" },
  { key: "vscode", label: "VS Code" },
] as const

type ClientId = (typeof CLIENTS)[number]["key"]

type Method = "key" | "oauth" | "cli"

const METHODS: { key: Method; label: string }[] = [
  { key: "key", label: "API key" },
  { key: "oauth", label: "Sign in" },
  { key: "cli", label: "Command line" },
]

const METHOD_COPY: Record<Method, string> = {
  key: "Simplest for personal use and automations. Paste a key, or create one above and it fills in here.",
  oauth:
    "Your app opens a browser, you sign in and pick permissions, and it gets a short-lived token. Nothing to copy. Works with apps that support MCP sign-in.",
  cli: "The timbl command line tool uses the same API, and installs a skill so Claude Code or Codex can run it for you.",
}

const CLIENT_PATH: Record<ClientId, string> = {
  cursor: "Add this to ~/.cursor/mcp.json, or .cursor/mcp.json in your project.",
  "claude-code": "Run this in your terminal.",
  "claude-desktop": "Add this to claude_desktop_config.json (Settings > Developer > Edit config).",
  vscode: "Add this to .vscode/mcp.json in your workspace.",
}

const KEY_PLACEHOLDER = "tmbl_pk_<your-key>"

const CLI_SNIPPET = [
  "npm i -g @timbl/cli",
  "timbl init                  # paste your tmbl_pk_ key and base URL",
  "timbl install --claude-code # or: timbl install --codex",
  "timbl posts list",
].join("\n")

const subscribeOrigin = () => () => {}
const getOriginSnapshot = () => window.location.origin
const getOriginServerSnapshot = () => "https://app.timbl.co"

function keySnippet(client: ClientId, url: string, key: string): string {
  switch (client) {
    case "claude-code":
      return `claude mcp add --transport http timbl ${url} \\\n  --header "Authorization: Bearer ${key}"`
    case "claude-desktop":
      return JSON.stringify(
        {
          mcpServers: {
            timbl: {
              command: "npx",
              args: ["-y", "mcp-remote", url, "--header", `Authorization: Bearer ${key}`],
            },
          },
        },
        null,
        2,
      )
    case "vscode":
      return JSON.stringify(
        { servers: { timbl: { type: "http", url, headers: { Authorization: `Bearer ${key}` } } } },
        null,
        2,
      )
    case "cursor":
      return JSON.stringify(
        { mcpServers: { timbl: { url, headers: { Authorization: `Bearer ${key}` } } } },
        null,
        2,
      )
  }
}

function oauthSnippet(client: ClientId, url: string): string {
  switch (client) {
    case "claude-code":
      return `claude mcp add --transport http timbl ${url}`
    case "claude-desktop":
      return JSON.stringify(
        { mcpServers: { timbl: { command: "npx", args: ["-y", "mcp-remote", url] } } },
        null,
        2,
      )
    case "vscode":
      return JSON.stringify({ servers: { timbl: { type: "http", url } } }, null, 2)
    case "cursor":
      return JSON.stringify({ mcpServers: { timbl: { url } } }, null, 2)
  }
}

function mask(key: string): string {
  return key.length > 12 ? `${key.slice(0, 12)}${"•".repeat(12)}` : key
}

export function McpConnector({ apiKey }: { apiKey: string | null }) {
  const origin = useSyncExternalStore(subscribeOrigin, getOriginSnapshot, getOriginServerSnapshot)
  const [method, setMethod] = useState<Method>("key")
  const [client, setClient] = useState<ClientId>("cursor")
  const [key, setKey] = useState(apiKey ?? "")
  const [seededKey, setSeededKey] = useState(apiKey)
  const [revealed, setRevealed] = useState(false)

  if (apiKey && apiKey !== seededKey) {
    setSeededKey(apiKey)
    setKey(apiKey)
  }

  const url = `${origin}/api/mcp`
  const trimmed = key.trim()
  const realKey = trimmed || KEY_PLACEHOLDER
  const shownKey = trimmed && !revealed ? mask(trimmed) : realKey

  const snippet =
    method === "cli" ? CLI_SNIPPET : method === "oauth" ? oauthSnippet(client, url) : keySnippet(client, url, realKey)
  const display = method === "key" ? keySnippet(client, url, shownKey) : snippet

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <ChoiceChips label="How to connect" options={METHODS} value={method} onChange={setMethod} />
        <p className="max-w-[64ch] text-[13px] leading-relaxed text-muted-foreground">{METHOD_COPY[method]}</p>
      </div>

      {method !== "cli" ? (
        <div className="space-y-2">
          <p className="text-[13px] font-medium text-foreground">App</p>
          <ChoiceChips
            label="App"
            options={CLIENTS.map((c) => ({ key: c.key, label: c.label }))}
            value={client}
            onChange={setClient}
          />
        </div>
      ) : null}

      {method === "key" ? (
        <div className="space-y-2">
          <label htmlFor="mcp-key" className="text-[13px] font-medium text-foreground">
            API key
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="mcp-key"
              type={revealed ? "text" : "password"}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="tmbl_pk_..."
              autoComplete="off"
              spellCheck={false}
              className="h-9 max-w-md font-mono text-[13px]"
            />
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? "Hide key" : "Show key"}
              aria-pressed={revealed}
            >
              {revealed ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            </Button>
          </div>
        </div>
      ) : null}

      {method !== "cli" ? (
        <div className="space-y-2">
          <p className="text-[13px] font-medium text-foreground">Server URL</p>
          <CopyField value={url} label="Copy server URL" />
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-[13px] text-muted-foreground">
          {method === "cli" ? "Run this in your terminal." : CLIENT_PATH[client]}
        </p>
        <div className="relative">
          <pre className="whitespace-pre-wrap rounded-lg bg-secondary py-3 pl-3 pr-14 font-mono text-[12px] leading-relaxed text-foreground wrap-anywhere">
            <code>{display}</code>
          </pre>
          <CopyButton value={snippet} label="Copy config" className="absolute right-1.5 top-1.5" />
        </div>
      </div>

      {method === "oauth" ? (
        <div className="space-y-2">
          <p className="text-[13px] font-medium text-foreground">Discovery endpoints</p>
          <CopyField
            value={`${origin}/.well-known/oauth-protected-resource`}
            label="Copy protected resource endpoint"
          />
          <CopyField
            value={`${origin}/.well-known/oauth-authorization-server`}
            label="Copy authorization server endpoint"
          />
        </div>
      ) : null}
    </div>
  )
}
