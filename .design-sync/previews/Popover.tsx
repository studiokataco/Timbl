import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  Button,
} from "timbl"

export function Default() {
  return (
    <Popover defaultOpen>
      <PopoverTrigger render={<Button variant="outline" />}>Post details</PopoverTrigger>
      <PopoverContent style={{ width: 260 }}>
        <PopoverHeader>
          <PopoverTitle>Spring launch teaser</PopoverTitle>
          <PopoverDescription>Instagram - carousel - Apr 12, 9:00 AM</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  )
}
