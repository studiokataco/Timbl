import type { ReactNode } from "react"

export function LegalShell({
  title,
  intro,
  updated,
  effective,
  children,
}: {
  title: string
  intro: string
  updated: string
  effective: string
  children: ReactNode
}) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 md:py-20">
      <header className="border-b border-border pb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {title}
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-foreground/75">{intro}</p>
        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-1 text-xs text-muted-foreground">
          <div className="flex gap-1.5">
            <dt className="font-medium text-foreground/70">Effective</dt>
            <dd>{effective}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="font-medium text-foreground/70">Last updated</dt>
            <dd>{updated}</dd>
          </div>
        </dl>
      </header>

      <div
        className={[
          "mt-10 space-y-10 text-[15px] leading-7 text-foreground/85",
          "[&_h2]:mt-0 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground",
          "[&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground",
          "[&_p]:mt-3",
          "[&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:marker:text-muted-foreground",
          "[&_a]:font-medium [&_a]:text-brand-accent [&_a]:underline-offset-2 hover:[&_a]:underline",
          "[&_section]:scroll-mt-24",
        ].join(" ")}
      >
        {children}
      </div>
    </article>
  )
}

export function LegalSection({
  id,
  heading,
  children,
}: {
  id: string
  heading: string
  children: ReactNode
}) {
  return (
    <section id={id}>
      <h2>{heading}</h2>
      {children}
    </section>
  )
}
