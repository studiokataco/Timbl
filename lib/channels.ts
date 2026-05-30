import type { ChannelKey } from "@/lib/schemas"

export const CHANNEL_LABELS: Record<ChannelKey, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  website: "Website",
  fb_groups: "FB Groups",
  x: "X",
}

export function resolveOrgChannels(input: {
  brandChannels?: ChannelKey[]
  onboardingChannels?: string[]
}): ChannelKey[] {
  if (input.brandChannels?.length) return input.brandChannels

  const fromOnboarding = (input.onboardingChannels ?? [])
    .map((id) => channelKeyFromWizardId(id))
    .filter((k): k is ChannelKey => k !== null)

  if (fromOnboarding.length) return [...new Set(fromOnboarding)]

  return ["instagram"]
}

function channelKeyFromWizardId(id: string): ChannelKey | null {
  if (id in CHANNEL_LABELS) return id as ChannelKey
  return null
}

export function channelsForComposer(keys: ChannelKey[]) {
  return keys.map((key) => ({ key, label: CHANNEL_LABELS[key] }))
}
