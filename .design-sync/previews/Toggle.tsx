import { Toggle } from "timbl"

export function Variants() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Toggle defaultPressed>Bold</Toggle>
      <Toggle>Italic</Toggle>
      <Toggle variant="outline" defaultPressed>
        Pinned
      </Toggle>
      <Toggle variant="outline">Muted</Toggle>
    </div>
  )
}

export function Sizes() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Toggle size="sm" defaultPressed>
        Small
      </Toggle>
      <Toggle size="default" defaultPressed>
        Default
      </Toggle>
      <Toggle size="lg" defaultPressed>
        Large
      </Toggle>
    </div>
  )
}
