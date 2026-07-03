"use client"

import { useState, useTransition } from "react"
import { Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Markdown } from "@/components/agents/markdown"
import { askPlatformAssistant } from "@/lib/actions/platform/assistant"

interface Turn {
  role: "user" | "assistant"
  text: string
  tool?: string
}

const SUGGESTIONS = [
  "Which org spent the most this month?",
  "Show recent failing agents",
  "What's our estimated MRR?",
  "Break down cost by model",
]

export function AssistantChat() {
  const [turns, setTurns] = useState<Turn[]>([])
  const [value, setValue] = useState("")
  const [pending, start] = useTransition()

  const ask = (question: string) => {
    const q = question.trim()
    if (!q || pending) return
    setTurns((t) => [...t, { role: "user", text: q }])
    setValue("")
    start(async () => {
      const res = await askPlatformAssistant({ question: q })
      setTurns((t) => [
        ...t,
        res.ok
          ? { role: "assistant", text: res.answer ?? "(no answer)", tool: res.tool }
          : { role: "assistant", text: `Error: ${res.error ?? "unknown"}` },
      ])
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="min-h-64 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        {turns.length === 0 ? (
          <div className="flex flex-col items-start gap-3 py-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4" /> Ask about usage, cost, tenants, or ops.
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {turns.map((turn, i) => (
              <div
                key={i}
                className={turn.role === "user" ? "self-end" : "self-start"}
              >
                <div
                  className={`max-w-2xl rounded-lg px-3 py-2 text-sm ${
                    turn.role === "user"
                      ? "whitespace-pre-wrap bg-foreground text-background"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {turn.role === "assistant" ? (
                    <Markdown>{turn.text}</Markdown>
                  ) : (
                    turn.text
                  )}
                </div>
                {turn.tool ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    via {turn.tool}
                  </div>
                ) : null}
              </div>
            ))}
            {pending ? (
              <div className="self-start rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                Thinking...
              </div>
            ) : null}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          ask(value)
        }}
        className="flex items-center gap-2"
      >
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask the control centre..."
          disabled={pending}
        />
        <Button type="submit" disabled={pending || !value.trim()}>
          Ask
        </Button>
      </form>
    </div>
  )
}
