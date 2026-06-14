"use client"

import { useEffect, useState } from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SettingDisclosure } from "@/components/settings/setting-disclosure"
import { cn } from "@/lib/utils"

const CLIENTS = [
  { id: "cursor", label: "Cursor" },
  { id: "claude-code", label: "Claude Code" },
  { id: "claude-desktop", label: "Claude Desktop" },
  { id: "vscode", label: "VS Code" },
] as const

type ClientId = (typeof CLIENTS)[number]["id"]

function CopyBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast.success("Copied to clipboard")
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Couldn't copy - select and copy manually")
    }
  }

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Copy"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
      <pre className="overflow-x-auto rounded-lg border border-border bg-muted px-3 py-3 pr-12 text-xs leading-relaxed">
        <code className={lang ? `language-${lang}` : undefined}>{code}</code>
      </pre>
    </div>
  )
}

function apiKeySnippet(client: ClientId, url: string, key: string): string {
  const k = key || "tmbl_pk_<your-key>"
  switch (client) {
    case "claude-code":
      return `claude mcp add --transport http timbl ${url} \\\n  --header "Authorization: Bearer ${k}"`
    case "claude-desktop":
      return JSON.stringify(
        {
          mcpServers: {
            timbl: {
              command: "npx",
              args: ["-y", "mcp-remote", url, "--header", `Authorization: Bearer ${k}`],
            },
          },
        },
        null,
        2,
      )
    case "vscode":
      return JSON.stringify(
        { servers: { timbl: { type: "http", url, headers: { Authorization: `Bearer ${k}` } } } },
        null,
        2,
      )
    case "cursor":
    default:
      return JSON.stringify(
        { mcpServers: { timbl: { url, headers: { Authorization: `Bearer ${k}` } } } },
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
    default:
      return JSON.stringify({ mcpServers: { timbl: { url } } }, null, 2)
  }
}

function clientPath(client: ClientId): string {
  switch (client) {
    case "cursor":
      return "Add to ~/.cursor/mcp.json (or .cursor/mcp.json in your project)."
    case "claude-code":
      return "Run in your terminal."
    case "claude-desktop":
      return "Add to claude_desktop_config.json (Settings -> Developer -> Edit config)."
    case "vscode":
      return "Add to .vscode/mcp.json in your workspace."
  }
}

export function McpConnector({ apiKey }: { apiKey: string | null }) {
  const [origin, setOrigin] = useState("https://app.timbl.co")
  const [client, setClient] = useState<ClientId>("cursor")
  const [key, setKey] = useState(apiKey ?? "")

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    if (apiKey) setKey(apiKey)
  }, [apiKey])

  const url = `${origin}/api/mcp`

  return (
    <div className="space-y-2">
      <SettingDisclosure
        title="API key"
        summary="Simplest - paste a key, drop the config in"
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Simplest for personal use and automations. Paste a key (or create
            one above - it auto-fills here right after creation).
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="mcp-key">API key</Label>
            <Input
              id="mcp-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="tmbl_pk_..."
              className="font-mono text-xs"
            />
          </div>
          <ClientPicker client={client} onChange={setClient} />
          <p className="text-xs text-muted-foreground">{clientPath(client)}</p>
          <CopyBlock
            code={apiKeySnippet(client, url, key)}
            lang={client === "claude-code" ? "bash" : "json"}
          />
        </div>
      </SettingDisclosure>

      <SettingDisclosure
        title="OAuth (sign in)"
        summary="User-delegated - no key to copy"
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            User-delegated. The client opens a browser, you sign in and pick
            scopes, and it receives a short-lived <code>tmbl_at_</code> token -
            no key to copy. Works with clients that support MCP OAuth discovery.
          </p>
          <ClientPicker client={client} onChange={setClient} />
          <p className="text-xs text-muted-foreground">{clientPath(client)}</p>
          <CopyBlock
            code={oauthSnippet(client, url)}
            lang={client === "claude-code" ? "bash" : "json"}
          />
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground space-y-0.5">
            <p className="font-medium text-foreground">Discovery endpoints</p>
            <p className="font-mono break-all">{origin}/.well-known/oauth-protected-resource</p>
            <p className="font-mono break-all">{origin}/.well-known/oauth-authorization-server</p>
          </div>
        </div>
      </SettingDisclosure>

      <SettingDisclosure
        title="CLI"
        summary="The timbl CLI over the same REST API"
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Not MCP - the <code>timbl</code> CLI drives the same REST API, and
            installs a skill so Claude Code or Codex can run it for you.
          </p>
          <CopyBlock
            code={[
              "npm i -g @timbl/cli",
              "timbl init                  # paste your tmbl_pk_ key + base URL",
              "timbl install --claude-code # or: timbl install --codex",
              "timbl posts list",
            ].join("\n")}
            lang="bash"
          />
        </div>
      </SettingDisclosure>
    </div>
  )
}

function ClientPicker({
  client,
  onChange,
}: {
  client: ClientId
  onChange: (c: ClientId) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CLIENTS.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-colors",
            client === c.id
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}
