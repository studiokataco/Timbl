import { SegmentedTabs } from "timbl"

const tabs = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
]

export function Default() {
  return (
    <div style={{ width: 280 }}>
      <SegmentedTabs tabs={tabs} value="week" onChange={() => {}} />
    </div>
  )
}
