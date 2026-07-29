import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
  Button,
} from "timbl"

export function Default() {
  return (
    <TooltipProvider>
      <Tooltip defaultOpen>
        <TooltipTrigger render={<Button variant="outline" />}>Best time</TooltipTrigger>
        <TooltipContent>Posts at 9:00 AM get the most reach</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
