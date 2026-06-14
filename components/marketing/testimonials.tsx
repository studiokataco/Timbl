import { Star } from "lucide-react"

import { Reveal } from "./reveal"

const QUOTES = [
  {
    quote:
      "We run nineteen brands off one calendar now. The crossed-wires between clients just stopped happening.",
    name: "Maya Okonkwo",
    role: "Founder, Sundial Social",
    fill: "#fb923c",
  },
  {
    quote:
      "The agents fill the quiet gaps with real first drafts. I went from writing every post to approving them.",
    name: "Daniel Reyes",
    role: "Content lead, Northwind",
    fill: "#34d399",
  },
  {
    quote:
      "Onboarding a new client used to take a day of setup. Now it is a workspace, their channels, and we are planning.",
    name: "Priya Nair",
    role: "Managing director, Loop & Co",
    fill: "#8b5cf6",
  },
]

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
}

export function Testimonials() {
  return (
    <section className="bg-muted px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-4xl font-semibold tracking-tight">
            Loved by the teams running the most brands
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Agencies and in-house teams use Timbl to keep every client&apos;s
            social calm, consistent and on time.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {QUOTES.map((t, i) => (
            <Reveal
              key={t.name}
              delay={i * 0.1}
              className="glass flex flex-col rounded-2xl p-6"
            >
              <div className="flex gap-0.5 text-warning">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} className="size-4 fill-current" />
                ))}
              </div>
              <p className="mt-4 flex-1 text-pretty text-[15px] leading-relaxed">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-3">
                <span
                  className="flex size-9 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: t.fill }}
                >
                  {initials(t.name)}
                </span>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-[13px] text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
