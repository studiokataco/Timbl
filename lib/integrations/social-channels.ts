import "server-only"

export function socialChannelsEnabled(): boolean {
  return process.env.SOCIAL_CHANNELS_ENABLED === "1"
}
