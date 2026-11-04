import type { MicState } from "../types"

export type MicEvent =
  | { type: "press" }
  | { type: "hold_start" }
  | { type: "hold_end" }
  | { type: "permission"; granted: boolean }
  | { type: "endpoint" }
  | { type: "transcribed" }
  | { type: "cancel" }
  | { type: "fail" }

export function micReducer(state: MicState, event: MicEvent, firstUse: boolean): MicState {
  if (event.type === "fail") return "error"
  switch (state) {
    case "idle":
      if (event.type === "press" || event.type === "hold_start") return firstUse ? "requesting" : "listening"
      return state
    case "requesting":
      if (event.type === "permission") return event.granted ? "listening" : "denied"
      if (event.type === "cancel") return "idle"
      return state
    case "listening":
      if (event.type === "press" || event.type === "hold_end" || event.type === "endpoint") return "transcribing"
      if (event.type === "cancel") return "idle"
      if (event.type === "permission" && !event.granted) return "denied"
      return state
    case "transcribing":
      if (event.type === "transcribed") return "idle"
      return state
    case "error":
      if (event.type === "press" || event.type === "hold_start") return "listening"
      return state
    case "denied":
      if (event.type === "press" || event.type === "hold_start") return "requesting"
      if (event.type === "permission") return event.granted ? "listening" : "denied"
      if (event.type === "cancel") return "idle"
      return state
  }
}
