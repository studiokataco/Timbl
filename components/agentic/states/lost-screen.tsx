import { Button } from "@/components/ui/button"

type LostScreenProps = {
  code: string
  title: string
  body?: string
  primary: string
  secondary?: string
  layout?: "page" | "panel"
}

export function LostScreen({ code, title, body = "", primary, secondary, layout = "panel" }: LostScreenProps): React.JSX.Element {
  if (layout === "page") {
    return (
      <button
        type="button"
        className="flex min-h-[40rem] w-full cursor-pointer flex-col items-center justify-center bg-background p-8 text-center text-foreground focus-ring focus-visible:-outline-offset-8"
      >
        <div className="flex max-w-md flex-col items-center gap-4">
          <p className="font-mono text-caption text-muted-foreground">{code}</p>
          <span className="text-title-lg">{title}</span>
          <span className="inline-flex h-8 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">{primary}</span>
        </div>
      </button>
    )
  }

  return (
    <section className="flex flex-col items-start gap-4 bg-background p-8 text-foreground">
      <p className="font-mono text-caption text-muted-foreground">{code}</p>
      <div className="flex max-w-md flex-col items-start gap-2">
        <h1 className="text-title-lg text-foreground">{title}</h1>
        <p className="text-body-sm text-pretty text-muted-foreground">{body}</p>
      </div>
      <Actions primary={primary} secondary={secondary} />
    </section>
  )
}

function Actions({ primary, secondary }: { primary: string; secondary?: string }): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button">{primary}</Button>
      {secondary ? (
        <Button type="button" variant="ghost">
          {secondary}
        </Button>
      ) : null}
    </div>
  )
}
