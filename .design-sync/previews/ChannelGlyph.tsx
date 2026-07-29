import { ChannelGlyph } from "timbl"

const channels = ["instagram", "x", "linkedin", "facebook"] as const

export function Channels() {
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
      {channels.map((c) => (
        <span key={c} style={{ width: 28, height: 28, display: "inline-flex" }}>
          <ChannelGlyph channel={c} />
        </span>
      ))}
    </div>
  )
}
