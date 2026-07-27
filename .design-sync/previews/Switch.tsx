import { Switch, Label } from "timbl"

function Row({ id, checked, disabled, children }: any) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Switch id={id} checked={checked} disabled={disabled} />
      <Label htmlFor={id}>{children}</Label>
    </div>
  )
}

export function States() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Row id="sw-1" checked>
        Auto-publish enabled
      </Row>
      <Row id="sw-2" checked={false}>
        Notify on failure
      </Row>
      <Row id="sw-3" checked disabled>
        Locked on by admin
      </Row>
    </div>
  )
}
