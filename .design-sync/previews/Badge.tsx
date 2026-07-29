import { Badge } from "timbl"

export function Variants() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <Badge>Scheduled</Badge>
      <Badge variant="secondary">Draft</Badge>
      <Badge variant="destructive">Failed</Badge>
      <Badge variant="outline">Idea</Badge>
      <Badge variant="ghost">Archived</Badge>
    </div>
  )
}

export function StatusPills() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <Badge variant="secondary">In review</Badge>
      <Badge variant="secondary">Researching</Badge>
      <Badge variant="secondary">Designing</Badge>
      <Badge variant="outline">3 channels</Badge>
    </div>
  )
}
