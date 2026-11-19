import type { BriefFields, PresencePrefs, PresenceSlot, ReactionEmoji, RunKind, TeamMember } from "./types"

export const ASSISTANT_ID = "assistant"

export const DEFAULT_PREFS = {
  reduceMotion: false,
  largerTarget: false,
  tips: true,
  voiceLocale: "en-IN",
  personality: "calm",
  workingStyle: "Keep information concise. Bring a point of view. Ask only when a decision changes the outcome.",
  showCursors: null,
  shortcuts: true,
  ambient: { glow: true, backgroundMotion: true },
} satisfies PresencePrefs

export const REACTION_EMOJI: ReactionEmoji[] = ["👍", "❤️", "🎉", "😂", "👀", "🙌", "🔥", "✅"]
export const REACTION_NAMES: Record<ReactionEmoji, string> = {
  "👍": "Thumbs up",
  "❤️": "Heart",
  "🎉": "Party popper",
  "😂": "Laughing",
  "👀": "Eyes",
  "🙌": "Raised hands",
  "🔥": "Fire",
  "✅": "Check mark",
}

export const DEFAULT_BRIEF: BriefFields = {
  campaignName: "",
  objective: "awareness",
  startDate: "",
  channels: "ig_li",
  volume: "three_with_reel",
}

export const RUN_AGENTS: Record<RunKind, { agent: string; stages: string[] }> = {
  ideas: { agent: "ideator", stages: ["ideator"] },
  plan: { agent: "awareness-researcher", stages: ["awareness-researcher", "ideator"] },
  create: { agent: "pipeline", stages: ["drafter", "reviewer", "human-gate", "scheduler"] },
  refine: { agent: "drafter", stages: ["drafter"] },
  advice: { agent: "drafter", stages: ["drafter"] },
  chat: { agent: "drafter", stages: ["drafter"] },
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ""
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export function asTeamMember(user: {
  id: string
  organizationId: string
  email: string
  name: string
  role: TeamMember["role"]
  active: boolean
  defaultCategories: string[]
  avatarUrl?: string
}, index: number): TeamMember {
  return {
    ...user,
    initials: initials(user.name),
    presenceSlot: ((index % 8) + 1) as PresenceSlot,
  }
}
