import { TimblLogo, TimblWordmark } from "timbl"

export function Mark() {
  return (
    <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
      <TimblLogo size={28} />
      <TimblLogo size={40} />
      <TimblLogo size={56} />
    </div>
  )
}

export function Wordmark() {
  return <TimblWordmark />
}
