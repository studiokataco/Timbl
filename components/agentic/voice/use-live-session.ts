"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { mintLiveSessionToken } from "@/lib/actions/live-session"
import { LIVE_MODEL } from "@/lib/constants/timbl"
import type { EngineEvent, ResolvedEntityChip, TalkState, VoiceToken } from "../types"
import { scriptedAudio } from "./scripted"

const SILENCE_MS = 20_000
const HARD_MS = 10 * 60_000
const LIVE_RATE = 16_000

function pcmBase64(input: Float32Array, fromRate: number): string {
  const ratio = fromRate / LIVE_RATE
  const length = Math.max(1, Math.floor(input.length / ratio))
  const bytes = new Uint8Array(length * 2)
  const view = new DataView(bytes.buffer)
  for (let i = 0; i < length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)] ?? 0))
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export type SpokenTool = { id: string; name: string; args: Record<string, unknown> }

const SPOKEN_TOOLS: { name: string; description: string; keys: string[] }[] = [
  { name: "ideas", description: "Research campaign directions with the ideator", keys: ["brief"] },
  { name: "plan", description: "Plan a campaign around an awareness day", keys: ["brief"] },
  { name: "create", description: "Draft posts with the pipeline", keys: ["brief"] },
  { name: "tighten", description: "Rewrite a caption with the drafter", keys: ["instruction"] },
  { name: "schedule", description: "Propose a schedule. Does not publish", keys: ["when"] },
  { name: "approvals", description: "Show what needs approval", keys: [] },
  { name: "publish", description: "Ask to publish. Waits for approval", keys: ["target"] },
  { name: "delete_post", description: "Ask to delete a post. Waits for approval", keys: ["target"] },
  { name: "reschedule", description: "Ask to move a post. Waits for approval", keys: ["target", "when"] },
  { name: "bulk_approve", description: "Ask to approve every open draft", keys: [] },
  { name: "deck_approve", description: "Approve the draft on screen", keys: [] },
  { name: "deck_skip", description: "Skip the draft on screen", keys: [] },
  { name: "deck_undo", description: "Undo the last deck decision", keys: [] },
]

export function phraseForTool(name: string, args: Record<string, unknown>): string {
  const text = (key: string) => (typeof args[key] === "string" ? (args[key] as string) : "")
  switch (name) {
    case "ideas":
      return `explore ideas ${text("brief")}`.trim()
    case "plan":
      return `plan a campaign ${text("brief")}`.trim()
    case "create":
      return `draft social posts ${text("brief")}`.trim()
    case "tighten":
      return `rewrite the hook ${text("instruction")}`.trim()
    case "schedule":
      return `schedule ${text("when")}`.trim()
    case "approvals":
      return "review approvals"
    case "publish":
      return `publish ${text("target") || "it"}`.trim()
    case "delete_post":
      return `delete ${text("target") || "the post"}`.trim()
    case "reschedule":
      return `reschedule ${text("target") || "the post"} to ${text("when")}`.trim()
    case "bulk_approve":
      return "approve all"
    default:
      return ""
  }
}

export function applySpokenTool(tool: SpokenTool, dispatch: (event: EngineEvent) => void, deckPostId: string | null) {
  if (tool.name === "deck_undo") {
    dispatch({ type: "deck_undo" })
    return
  }
  if (deckPostId && (tool.name === "deck_approve" || tool.name === "deck_skip")) {
    dispatch({ type: "deck_decided", postId: deckPostId, outcome: tool.name === "deck_approve" ? "approved" : "skipped" })
    return
  }
  const phrase = phraseForTool(tool.name, tool.args)
  if (phrase) dispatch({ type: "user_sent", text: phrase, source: "voice" })
}

function pcmSamples(data: string): Float32Array {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  const view = new DataView(bytes.buffer)
  const samples = new Float32Array(Math.floor(bytes.length / 2))
  for (let i = 0; i < samples.length; i += 1) samples[i] = view.getInt16(i * 2, true) / 0x8000
  return samples
}

type Mode = "talk" | "dictate"
type SessionApi = {
  close: () => Promise<void> | void
  sendRealtimeInput?: (input: { audio: { data: string; mimeType: string } }) => void
  sendToolResponse?: (params: { functionResponses: { id?: string; name?: string; response: Record<string, unknown> }[] }) => void
}

export function chipsFrom(text: string): ResolvedEntityChip[] {
  const out: ResolvedEntityChip[] = []
  const day = text.match(/\b(today|tomorrow|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i)
  const time = text.match(/\b(\d{1,2}:\d{2})\b/)
  const action = text.match(/\b(schedule|reschedule|publish|delete|approve|plan)\b/i)
  if (day) out.push({ kind: "action", label: day[0] })
  if (time) out.push({ kind: "action", label: time[1] })
  if (action) out.push({ kind: "action", label: action[0] })
  return out.slice(0, 3)
}

export function useLiveSession(options?: { onTool?: (tool: SpokenTool) => void; instruction?: string }) {
  const [talkState, setTalkState] = useState<TalkState>("idle")
  const [tokens, setTokens] = useState<VoiceToken[]>([])
  const [level, setLevel] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onToolRef = useRef(options?.onTool)
  const instructionRef = useRef(options?.instruction)
  useEffect(() => {
    onToolRef.current = options?.onTool
    instructionRef.current = options?.instruction
  }, [options?.instruction, options?.onTool])
  const sessionRef = useRef<SessionApi | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<AudioContext | null>(null)
  const silenceRef = useRef<number>(0)
  const hardRef = useRef<number>(0)
  const lastVoiceRef = useRef(0)
  const modeRef = useRef<Mode>("talk")
  const sentRef = useRef(false)
  const toolHandledRef = useRef(false)
  const finalRef = useRef("")
  const playAtRef = useRef(0)
  const sourcesRef = useRef<AudioBufferSourceNode[]>([])
  const playingRef = useRef(false)
  const scriptedLevelRef = useRef(0)

  const teardown = useCallback(async () => {
    window.clearInterval(silenceRef.current)
    window.clearInterval(scriptedLevelRef.current)
    window.clearTimeout(hardRef.current)
    sessionRef.current?.close()
    sessionRef.current = null
    for (const node of sourcesRef.current) {
      try { node.stop() } catch {}
    }
    sourcesRef.current = []
    playingRef.current = false
    setPlaying(false)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    await audioRef.current?.close().catch(() => undefined)
    audioRef.current = null
    setLevel(0)
  }, [])

  const close = useCallback(async () => {
    await teardown()
    setTalkState("idle")
  }, [teardown])

  const start = useCallback(
    async (mode: Mode) => {
      await teardown()
      modeRef.current = mode
      sentRef.current = false
      toolHandledRef.current = false
      finalRef.current = ""
      setTokens([])
      setError(null)
      setTalkState("requesting")
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        setTalkState("denied")
        return
      }
      streamRef.current = stream
      const minted = await mintLiveSessionToken()
      if (!minted.ok || !minted.token) {
        stream.getTracks().forEach((track) => track.stop())
        setError(minted.error ?? "Voice is not configured")
        setTalkState("idle")
        return
      }
      const ctx = new AudioContext()
      audioRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      const processor = ctx.createScriptProcessor(2048, 1, 1)
      const mute = ctx.createGain()
      mute.gain.value = 0
      source.connect(processor)
      processor.connect(mute)
      mute.connect(ctx.destination)
      processor.onaudioprocess = (event) => {
        const pcm = event.inputBuffer.getChannelData(0)
        sessionRef.current?.sendRealtimeInput?.({
          audio: { data: pcmBase64(pcm, ctx.sampleRate), mimeType: `audio/pcm;rate=${LIVE_RATE}` },
        })
      }
      const bins = new Uint8Array(analyser.fftSize)
      lastVoiceRef.current = Date.now()
      silenceRef.current = window.setInterval(() => {
        analyser.getByteTimeDomainData(bins)
        let sum = 0
        for (const sample of bins) {
          const n = (sample - 128) / 128
          sum += n * n
        }
        const rms = Math.sqrt(sum / bins.length)
        const next = Math.min(1, rms * 6)
        if (!playingRef.current) setLevel((prev) => prev + (next - prev) * (next > prev ? 0.6 : 0.18))
        if (next > 0.04) lastVoiceRef.current = Date.now()
        else if (Date.now() - lastVoiceRef.current > SILENCE_MS) {
          void close().then(() => {
            if (!finalRef.current) setTalkState("no_speech")
          })
        }
      }, 80)
      hardRef.current = window.setTimeout(() => {
        void close()
      }, HARD_MS)

      try {
        const { GoogleGenAI, Modality } = await import("@google/genai")
        const ai = new GoogleGenAI({
          apiKey: minted.token,
          httpOptions: { apiVersion: "v1alpha" },
        })
        const playPcm = (data: string, rate: number) => {
          const samples = pcmSamples(data)
          if (!samples.length) return
          const buffer = ctx.createBuffer(1, samples.length, rate)
          buffer.getChannelData(0).set(samples)
          const node = ctx.createBufferSource()
          node.buffer = buffer
          node.connect(ctx.destination)
          const startAt = Math.max(ctx.currentTime, playAtRef.current)
          node.start(startAt)
          playAtRef.current = startAt + buffer.duration
          sourcesRef.current.push(node)
          playingRef.current = true
          setPlaying(true)
          let sum = 0
          for (const sample of samples) sum += sample * sample
          setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 8))
          node.onended = () => {
            sourcesRef.current = sourcesRef.current.filter((item) => item !== node)
            if (sourcesRef.current.length === 0) {
              playingRef.current = false
              setPlaying(false)
            }
          }
        }
        const holder: { current: SessionApi | null } = { current: null }
        const session = await ai.live.connect({
          model: minted.model ?? LIVE_MODEL,
          config: {
            responseModalities: mode === "dictate" ? [Modality.TEXT] : [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: mode === "talk" ? {} : undefined,
            ...(mode === "talk"
              ? {
                  systemInstruction: instructionRef.current,
                  tools: [{
                    functionDeclarations: SPOKEN_TOOLS.map((tool) => ({
                      name: tool.name,
                      description: tool.description,
                      parametersJsonSchema: {
                        type: "object",
                        properties: Object.fromEntries(tool.keys.map((key) => [key, { type: "string" }])),
                      },
                    })),
                  }],
                }
              : {}),
          },
          callbacks: {
            onmessage: (message) => {
              const content = message.serverContent
              if (content?.interrupted) {
                for (const node of sourcesRef.current) node.stop()
                sourcesRef.current = []
                playAtRef.current = 0
                playingRef.current = false
                setPlaying(false)
              }
              for (const part of content?.modelTurn?.parts ?? []) {
                const data = part.inlineData?.data
                const mime = part.inlineData?.mimeType ?? ""
                if (typeof data === "string" && mime.includes("audio")) {
                  const rate = Number(mime.match(/rate=(\d+)/)?.[1] ?? 24000)
                  playPcm(data, rate)
                  lastVoiceRef.current = Date.now()
                }
              }
              const calls = message.toolCall?.functionCalls ?? []
              if (calls.length && modeRef.current === "talk") {
                toolHandledRef.current = true
                for (const call of calls) {
                  if (!call.name) continue
                  onToolRef.current?.({ id: call.id ?? call.name, name: call.name, args: call.args ?? {} })
                }
                holder.current?.sendToolResponse?.({
                  functionResponses: calls.flatMap((call) => call.name ? [{
                    id: call.id,
                    name: call.name,
                    response: { output: "Handed to the existing agent. Publish, delete, and schedule still wait for approval." },
                  }] : []),
                })
              }
              const input = content?.inputTranscription?.text
              const output = content?.outputTranscription?.text
              if (input) {
                finalRef.current = `${finalRef.current} ${input}`.trim()
                lastVoiceRef.current = Date.now()
                setTokens((curr) => [...curr, { text: input, final: Boolean(content?.turnComplete), atMs: Date.now() }])
              }
              if (output && modeRef.current === "talk") {
                lastVoiceRef.current = Date.now()
                setTokens((curr) => [...curr, { text: output, final: Boolean(content?.turnComplete), atMs: Date.now() }])
              }
            },
            onerror: () => {
              setTalkState("idle")
              setError("Live session failed")
              void teardown()
            },
            onclose: () => {
              setTalkState((curr) => (curr === "sending" ? "idle" : curr === "denied" ? curr : "idle"))
            },
          },
        })
        holder.current = session
        sessionRef.current = session
        setTalkState("listening")
      } catch (err) {
        stream.getTracks().forEach((track) => track.stop())
        setError(err instanceof Error ? err.message : "Live session failed")
        setTalkState("idle")
        await teardown()
      }
    },
    [close, teardown],
  )

  const consume = useCallback(() => {
    if (sentRef.current) return ""
    sentRef.current = true
    if (toolHandledRef.current) {
      toolHandledRef.current = false
      return ""
    }
    return finalRef.current.trim()
  }, [])

  useEffect(() => {
    if (!scriptedAudio()) return
    lastVoiceRef.current = Date.now()
    let frame = 0
    scriptedLevelRef.current = window.setInterval(() => {
      if (frame === 0) {
        setTalkState("listening")
        setError(null)
      }
      frame += 1
      setLevel(0.15 + 0.75 * Math.abs(Math.sin(frame / 4)))
    }, 200)
    silenceRef.current = window.setInterval(() => {
      if (Date.now() - lastVoiceRef.current <= SILENCE_MS) return
      window.clearInterval(scriptedLevelRef.current)
      void close().then(() => setTalkState("no_speech"))
    }, 400)
    return () => {
      window.clearInterval(scriptedLevelRef.current)
      window.clearInterval(silenceRef.current)
    }
  }, [close])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (talkState === "listening" || talkState === "requesting" || talkState === "sending") {
        event.preventDefault()
        void close()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [close, talkState])

  useEffect(() => () => {
    void teardown()
  }, [teardown])

  return {
    talkState,
    tokens,
    chips: chipsFrom(tokens.filter((token) => token.final).map((token) => token.text).join(" ")),
    level,
    playing,
    error,
    startTalk: () => start("talk"),
    startDictate: () => start("dictate"),
    close,
    consume,
    setTalkState,
  }
}
