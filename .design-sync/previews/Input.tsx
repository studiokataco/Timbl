import { Input, Label } from "timbl"

export function WithLabel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 280 }}>
      <Label htmlFor="in-1">Campaign name</Label>
      <Input id="in-1" defaultValue="Spring launch" />
    </div>
  )
}

export function States() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 280 }}>
      <Input placeholder="Search posts…" />
      <Input defaultValue="hello@timbl.dev" />
      <Input defaultValue="Locked field" disabled />
      <Input aria-invalid defaultValue="not-an-email" />
    </div>
  )
}
