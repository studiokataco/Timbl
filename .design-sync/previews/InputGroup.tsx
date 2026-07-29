import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupText,
  InputGroupButton,
} from "timbl"

export function SearchField() {
  return (
    <div style={{ width: 300 }}>
      <InputGroup>
        <InputGroupAddon align="inline-start">
          <InputGroupText>Search</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="posts, drafts, tags…" />
      </InputGroup>
    </div>
  )
}

export function WithButton() {
  return (
    <div style={{ width: 320 }}>
      <InputGroup>
        <InputGroupInput placeholder="timbl.dev/yourhandle" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton>Copy</InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}
