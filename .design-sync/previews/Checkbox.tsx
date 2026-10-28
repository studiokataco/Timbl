import { Checkbox, Label } from "timbl"

function Row({ id, children, ...props }: any) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Checkbox id={id} {...props} />
      <Label htmlFor={id}>{children}</Label>
    </div>
  )
}

export function States() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Row id="ck-1">Auto-schedule at best time</Row>
      <Row id="ck-2" defaultChecked>
        Cross-post to LinkedIn
      </Row>
      <Row id="ck-3" defaultChecked disabled>
        Add to content calendar
      </Row>
      <Row id="ck-4" disabled>
        Require approval before publish
      </Row>
    </div>
  )
}
