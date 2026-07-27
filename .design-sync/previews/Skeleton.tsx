import { Skeleton } from "timbl"

export function CardLoading() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", width: 300 }}>
      <Skeleton style={{ width: 40, height: 40, borderRadius: 9999 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <Skeleton style={{ height: 12, width: "70%" }} />
        <Skeleton style={{ height: 12, width: "45%" }} />
      </div>
    </div>
  )
}

export function Block() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 300 }}>
      <Skeleton style={{ height: 120, width: "100%" }} />
      <Skeleton style={{ height: 12, width: "90%" }} />
      <Skeleton style={{ height: 12, width: "60%" }} />
    </div>
  )
}
