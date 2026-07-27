import { Textarea, Label } from "timbl"

export function WithLabel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 320 }}>
      <Label htmlFor="ta-1">Caption</Label>
      <Textarea
        id="ta-1"
        rows={4}
        defaultValue={"Behind-the-scenes of the spring shoot.\nDrop a comment with your favourite look."}
      />
    </div>
  )
}

export function States() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 320 }}>
      <Textarea placeholder="Write a caption…" rows={3} />
      <Textarea defaultValue="Approved copy, locked." rows={2} disabled />
    </div>
  )
}
