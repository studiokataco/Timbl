import { BaseLlm } from "@google/adk"
import type { BaseLlmConnection, LlmRequest, LlmResponse } from "@google/adk"
import type { Content } from "@google/genai"

/*
 * MockLlm - a deterministic scripted model that returns a canned reply.
 * Activated when AGENT_MOCK_LLM=1. Used by /agent-browser smoke tests and
 * CI to exercise the streaming + persistence layers without burning real
 * tokens or requiring network access.
 *
 * Phase 1 ships a stub-mode that simply echoes a short greeting plus the
 * last user turn back to the caller. Phase 3 extends this to read a per-
 * agent fixture JSON describing a sequence of LlmResponses (including
 * tool_call blocks) so we can exercise the entire pipeline deterministically.
 */

export class MockLlm extends BaseLlm {
  static override readonly supportedModels: Array<string | RegExp> = [/^mock(:|$|-).*/]

  constructor(params: { model?: string } = {}) {
    super({ model: params.model ?? "mock:gemini" })
  }

  override async *generateContentAsync(
    llmRequest: LlmRequest,
    stream?: boolean,
    abortSignal?: AbortSignal,
  ): AsyncGenerator<LlmResponse, void> {
    void stream
    if (abortSignal?.aborted) return

    const lastUser = [...llmRequest.contents]
      .reverse()
      .find((c) => c.role === "user")
    const userText = extractText(lastUser) || "hello"

    const reply: Content = {
      role: "model",
      parts: [
        {
          text: `(mock) acknowledged: ${userText.slice(0, 160)}`,
        },
      ],
    }

    yield {
      content: reply,
      partial: false,
      turnComplete: true,
      finishReason: "STOP" as never,
      usageMetadata: {
        promptTokenCount: Math.max(1, Math.ceil(userText.length / 4)),
        candidatesTokenCount: 24,
        totalTokenCount: Math.max(1, Math.ceil(userText.length / 4)) + 24,
      } as never,
    } satisfies LlmResponse
  }

  override async connect(): Promise<BaseLlmConnection> {
    throw new Error("MockLlm does not support live bidi connections")
  }
}

function extractText(content: Content | undefined): string {
  if (!content?.parts) return ""
  return content.parts
    .map((p: { text?: string }) => (p.text ?? ""))
    .join("")
}
