import { Separator } from "timbl"

export function Horizontal() {
  return (
    <div style={{ width: 280 }}>
      <div style={{ fontSize: 14, fontWeight: 500 }}>Content calendar</div>
      <Separator style={{ margin: "10px 0" }} />
      <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
        12 scheduled - 3 drafts
      </div>
    </div>
  )
}

export function Vertical() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, height: 24, fontSize: 13 }}>
      <span>Drafts</span>
      <Separator orientation="vertical" />
      <span>Scheduled</span>
      <Separator orientation="vertical" />
      <span>Published</span>
    </div>
  )
}
