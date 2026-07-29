import { Tabs, TabsList, TabsTrigger, TabsContent } from "timbl"

export function Default() {
  return (
    <div style={{ width: 380 }}>
      <Tabs defaultValue="calendar">
        <TabsList>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
        </TabsList>
        <TabsContent value="calendar" style={{ paddingTop: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>
            12 posts scheduled across 4 channels this month.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
