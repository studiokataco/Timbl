"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { mintLiveSessionToken } from "@/lib/actions/live-session"
import { LIVE_MODEL } from "@/lib/constants/timbl"
import type { ResolvedEntityChip, TalkState, VoiceToken } from "../types"

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

type Mode = "talk" | "dictate"
type SessionApi = {
  close: () => Promise<void> | void
  sendRealtimeInput?: (input: { audio: { data: string; mimeType: string } }) => void
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

export function useLiveSession() {
  const [talkState, setTalkState] = useState<TalkState>("idle")
  const [tokens, setTokens] = useState<VoiceToken[]>([])
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const sessionRef = useRef<SessionApi | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<AudioContext | null>(null)
  const silenceRef = useRef<number>(0)
  const hardRef = useRef<number>(0)
  const lastVoiceRef = useRef(0)
  const modeRef = useRef<Mode>("talk")
  const sentRef = useRef(false)
  const finalRef = useRef("")

  const teardown = useCallback(async () => {
    window.clearInterval(silenceRef.current)
    window.clearTimeout(hardRef.current)
    sessionRef.current?.close()
    sessionRef.current = null
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
        setLevel((prev) => prev + (next - prev) * (next > prev ? 0.6 : 0.18))
        if (next > 0.04) lastVoiceRef.current = Date.now()
        else if (Date.now() - lastVoiceRef.current > SILENCE_MS) {
          void close()
          if (!finalRef.current) setTalkState("no_speech")
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
        const session = await ai.live.connect({
          model: minted.model ?? LIVE_MODEL,
          config: {
            responseModalities: mode === "dictate" ? [Modality.TEXT] : [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: mode === "talk" ? {} : undefined,
          },
          callbacks: {
            onmessage: (message) => {
              const content = message.serverContent
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
    return finalRef.current.trim()
  }, [])

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
    error,
    startTalk: () => start("talk"),
    startDictate: () => start("dictate"),
    close,
    consume,
    setTalkState,
  }
}
