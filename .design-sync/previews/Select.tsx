import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "timbl"

export function Default() {
  return (
    <Select defaultValue="instagram" defaultOpen>
      <SelectTrigger style={{ width: 220 }}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="instagram">Instagram</SelectItem>
        <SelectItem value="x">X</SelectItem>
        <SelectItem value="linkedin">LinkedIn</SelectItem>
        <SelectItem value="facebook">Facebook</SelectItem>
      </SelectContent>
    </Select>
  )
}
