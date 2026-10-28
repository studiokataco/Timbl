import { Label, Input } from "timbl"

export function Default() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 260 }}>
      <Label htmlFor="lb-1">Publish date</Label>
      <Input id="lb-1" defaultValue="Apr 12, 2026" />
    </div>
  )
}
