import { PageHeader, Button } from "timbl"

export function Default() {
  return (
    <div style={{ width: 560 }}>
      <PageHeader
        title="Content calendar"
        description="Plan, schedule, and track posts across every channel."
        action={<Button>New post</Button>}
      />
    </div>
  )
}

export function Compact() {
  return (
    <div style={{ width: 480 }}>
      <PageHeader size="sm" title="Drafts" description="7 posts waiting for review." />
    </div>
  )
}
