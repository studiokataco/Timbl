import { ToggleGroup, ToggleGroupItem } from "timbl"

export function ViewSwitcher() {
  return (
    <ToggleGroup defaultValue={["calendar"]} variant="outline">
      <ToggleGroupItem value="calendar">Calendar</ToggleGroupItem>
      <ToggleGroupItem value="kanban">Board</ToggleGroupItem>
      <ToggleGroupItem value="list">List</ToggleGroupItem>
    </ToggleGroup>
  )
}

export function Formatting() {
  return (
    <ToggleGroup defaultValue={["bold"]} spacing={4}>
      <ToggleGroupItem value="bold">B</ToggleGroupItem>
      <ToggleGroupItem value="italic">I</ToggleGroupItem>
      <ToggleGroupItem value="underline">U</ToggleGroupItem>
    </ToggleGroup>
  )
}
