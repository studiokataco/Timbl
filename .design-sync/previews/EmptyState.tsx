import { EmptyState, Button } from "timbl"
import { CalendarDays } from "lucide-react"

export function Default() {
  return (
    <div style={{ width: 380 }}>
      <EmptyState
        icon={CalendarDays}
        title="No posts scheduled"
        body="Plan your first post and it will show up on the calendar."
        action={<Button>New post</Button>}
      />
    </div>
  )
}
