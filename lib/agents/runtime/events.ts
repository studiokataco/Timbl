import type { Event } from "@google/adk"
import { toStructuredEvents } from "@google/adk"

import type { StructuredEvent } from "@google/adk"

/*
 * Streams adk-js Events as SSE frames suitable for direct return from a
 * Next.js Route Handler. Each yielded structured event becomes:
 *
 *   data: {"type":"content","content":"hello"}\n\n
 *
 * Plus periodic `:\n\n` heartbeat comments so intermediaries don't time out
 * idle connections. Heartbeats and abort handling are wired in here so the
 * route handler stays tiny.
 */

const HEARTBEAT_MS = 15_000
const enc = new TextEncoder()

export interface SseStreamOptions {
  /** Aborted when the client disconnects. The async generator should
   * unwind gracefully. */
  abortSignal?: AbortSignal
  /** Called once the stream has flushed its final event. Useful for
   * marking agentRuns.status. */
  onFinish?: (last: StructuredEvent | undefined) => void | Promise<void>
  /** Called for every raw Event before structured conversion. Used to
   * collect run metrics (token counts, tool calls). */
  onRawEvent?: (event: Event) => void
}

export function eventsToSseStream(
  source: AsyncGenerator<Event, void, undefined>,
  options: SseStreamOptions = {},
): ReadableStream<Uint8Array> {
  const { abortSignal, onFinish, onRawEvent } = options
  let lastStructured: StructuredEvent | undefined
  let heartbeat: ReturnType<typeof setInterval> | undefined

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(enc.encode(chunk))
        } catch {
          /* controller already closed */
        }
      }
      heartbeat = setInterval(() => send(":\n\n"), HEARTBEAT_MS)

      const onAbort = () => {
        try {
          source.return?.(undefined as never)
        } catch {
          /* swallow */
        }
      }
      abortSignal?.addEventListener("abort", onAbort)

      try {
        for await (const raw of source) {
          onRawEvent?.(raw)
          for (const structured of toStructuredEvents(raw)) {
            lastStructured = structured
            send(`data: ${serializeEvent(structured)}\n\n`)
          }
          if (abortSignal?.aborted) break
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        send(
          `event: error\ndata: ${JSON.stringify({ type: "error", error: message })}\n\n`,
        )
      } finally {
        if (heartbeat) clearInterval(heartbeat)
        abortSignal?.removeEventListener("abort", onAbort)
        try {
          await onFinish?.(lastStructured)
        } catch {
          /* host already torn down */
        }
        send(`event: close\ndata: {}\n\n`)
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat)
      try {
        source.return?.(undefined as never)
      } catch {
        /* swallow */
      }
    },
  })
}

function serializeEvent(event: StructuredEvent): string {
  /* `Error` instances inside ErrorEvent don't round-trip through
   * JSON.stringify by default. Flatten to a plain object so the wire
   * payload is useful. */
  if (event.type === "error") {
    return JSON.stringify({
      type: "error",
      error: {
        name: event.error.name,
        message: event.error.message,
      },
    })
  }
  return JSON.stringify(event)
}

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-store, no-transform",
  Connection: "keep-alive",
  "X-Content-Type-Options": "nosniff",
  "X-Accel-Buffering": "no",
} as const
