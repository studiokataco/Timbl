import type { TalkState } from "../types"

export type TalkEvent =
  | { type: "open" }
  | { type: "permission"; granted: boolean }
  | { type: "token" }
  | { type: "endpoint" }
  | { type: "orb_press" }
  | { type: "hold_start" }
  | { type: "hold_end" }
  | { type: "sent" }
  | { type: "no_speech" }
  | { type: "retry" }
  | { type: "close" }
  | { type: "type_instead" }

export function talkReducer(state: TalkState, event: TalkEvent, firstUse: boolean): TalkState {
  if (event.type === "close" || event.type === "type_instead") return "idle"
  switch (state) {
    case "idle":
      if (event.type === "permission" && !event.granted) return "denied"
      if (event.type === "open" || event.type === "orb_press" || event.type === "hold_start") {
        return firstUse ? "requesting" : "listening"
      }
      return state
    case "requesting":
      if (event.type === "permission") return event.granted ? "listening" : "denied"
      return state
    case "listening":
      if (event.type === "permission" && !event.granted) return "denied"
      if (event.type === "endpoint" || event.type === "orb_press" || event.type === "hold_end") return "sending"
      if (event.type === "no_speech") return "no_speech"
      return state
    case "sending":
      if (event.type === "sent") return "idle"
      return state
    case "no_speech":
      if (event.type === "retry" || event.type === "orb_press" || event.type === "hold_start") return "listening"
      return state
    case "denied":
      return state
  }
}
