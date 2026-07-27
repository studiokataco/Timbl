import { Avatar, AvatarFallback } from "timbl"

export function Sizes() {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
      <Avatar size="sm">
        <AvatarFallback>AK</AvatarFallback>
      </Avatar>
      <Avatar size="default">
        <AvatarFallback>MR</AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>TB</AvatarFallback>
      </Avatar>
    </div>
  )
}

export function Group() {
  return (
    <div style={{ display: "flex" }}>
      {["AK", "MR", "TB", "JD"].map((initials, i) => (
        <Avatar
          key={initials}
          style={{ marginLeft: i ? -8 : 0, boxShadow: "0 0 0 2px var(--background)" }}
        >
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      ))}
    </div>
  )
}
