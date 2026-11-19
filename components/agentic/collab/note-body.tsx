"use client"

import { Fragment } from "react"
import { usePrototype } from "../prototype-context"
import { parseNoteBody, tw } from "../lib"
import type { NoteAnnotation, NoteSpan, TeamMember } from "../types"

type NoteBodyProps = { body: string; annotations: NoteAnnotation[]; team: TeamMember[]; viewerId: string }

const SAFE_HREF = /^https?:\/\//i

function Span({ span, team }: { span: NoteSpan; team: TeamMember[] }): React.JSX.Element {
  const { copy } = usePrototype()
  if (span.kind === "mention") {
    const member = team.find((m) => m.id === span.userId)
    return (
      <span
        aria-label={copy.notes.mentionAria(member?.name ?? span.text.replace(/^@/, ""))}
        data-figma="NoteBody/mention"
        className="rounded-sm bg-muted px-1 font-medium"
      >
        {span.text}
      </span>
    )
  }
  if (span.kind === "link") {
    if (!SAFE_HREF.test(span.url)) return <>{span.text}</>
    return (
      <a href={span.url} target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2">
        {span.text}
      </a>
    )
  }
  let node: React.ReactNode = span.text
  if (span.code) node = <code className="rounded-sm bg-muted px-1 text-xs">{node}</code>
  if (span.em) node = <em>{node}</em>
  if (span.strong) node = <strong className="font-semibold">{node}</strong>
  return <>{node}</>
}

function Spans({ spans, team }: { spans: NoteSpan[]; team: TeamMember[] }): React.JSX.Element {
  return (
    <>
      {spans.map((span, i) => (
        <Span key={i} span={span} team={team} />
      ))}
    </>
  )
}

export function NoteBody({ body, annotations, team }: NoteBodyProps): React.JSX.Element {
  const blocks = parseNoteBody(body, annotations)
  return (
    <div data-slot="agentic-note-body" data-figma="NoteBody" className="flex min-w-0 flex-col gap-2 break-words">
      {blocks.map((block, i) => (
        <Fragment key={i}>
          {block.kind === "paragraph" ? (
            <p className={tw("text-body-sm whitespace-pre-wrap text-foreground")}>
              <Spans spans={block.spans} team={team} />
            </p>
          ) : (
            <ul className="text-body-sm list-disc pl-5 text-foreground">
              {block.items.map((item, j) => (
                <li key={j}>
                  <Spans spans={item} team={team} />
                </li>
              ))}
            </ul>
          )}
        </Fragment>
      ))}
    </div>
  )
}
