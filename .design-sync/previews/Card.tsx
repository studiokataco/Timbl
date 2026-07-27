import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
  Button,
  Badge,
} from "timbl"

export function ContentCard() {
  return (
    <div style={{ width: 340 }}>
      <Card>
        <CardHeader>
          <CardTitle>Spring launch teaser</CardTitle>
          <CardDescription>Instagram - carousel, 3 slides</CardDescription>
          <CardAction>
            <Badge variant="secondary">Draft</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p style={{ margin: 0 }}>
            Behind-the-scenes look at the new collection. Warm, editorial tone with a
            single call to action in the final slide.
          </p>
        </CardContent>
        <CardFooter style={{ justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            Scheduled for Apr 12
          </span>
          <Button size="sm">Open</Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export function Compact() {
  return (
    <div style={{ width: 300 }}>
      <Card size="sm">
        <CardHeader>
          <CardTitle>Weekly recap thread</CardTitle>
          <CardDescription>X - 5 posts</CardDescription>
        </CardHeader>
        <CardContent>
          <p style={{ margin: 0 }}>Queued and ready to publish Friday morning.</p>
        </CardContent>
      </Card>
    </div>
  )
}
