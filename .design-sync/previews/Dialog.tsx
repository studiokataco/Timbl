import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from "timbl"

export function Default() {
  return (
    <Dialog defaultOpen>
      <DialogTrigger render={<Button variant="outline" />}>Schedule post</DialogTrigger>
      <DialogContent style={{ width: 380 }}>
        <DialogHeader>
          <DialogTitle>Schedule this post</DialogTitle>
          <DialogDescription>
            It will publish to Instagram and LinkedIn at the chosen time.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button>Schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
