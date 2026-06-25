/* Known per-org feature flags. Add a key here to surface a toggle in the
 * control centre; a missing key reads as `false` (lib/schemas/organisation.ts
 * hasFeatureFlag). Shared by the server action (flags.ts) and the control UI. */
export const KNOWN_FEATURE_FLAGS = ["public_api_v1", "realtime_v1"] as const

export type KnownFeatureFlag = (typeof KNOWN_FEATURE_FLAGS)[number]

export const FEATURE_FLAG_LABEL: Record<KnownFeatureFlag, string> = {
  public_api_v1: "Public API",
  realtime_v1: "Live updates (realtime)",
}
