import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Button,
  Label,
  Switch,
} from "timbl"

export function Default() {
  return (
    <Sheet defaultOpen>
      <SheetTrigger render={<Button variant="outline" />}>Filters</SheetTrigger>
      <SheetContent side="right" style={{ padding: 20 }}>
        <SheetHeader style={{ padding: 0 }}>
          <SheetTitle>Filter calendar</SheetTitle>
          <SheetDescription>Narrow the view by channel and status.</SheetDescription>
        </SheetHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Switch id="sh-1" checked />
            <Label htmlFor="sh-1">Scheduled only</Label>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Switch id="sh-2" checked={false} />
            <Label htmlFor="sh-2">Include drafts</Label>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
