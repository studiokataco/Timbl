"use client"

import { useRef } from "react"

import { gsap, landingScroller, useGSAP } from "./gsap"

type DeckPost = {
  category: string
  color: string
  title: string
  type: string
  channel: string
  channelColor: string
  when: string
}

const DECK: DeckPost[] = [
  { category: "Behind the scenes", color: "#fbcfe8", title: "Studio tour reel", type: "Reel", channel: "Instagram", channelColor: "#E1306C", when: "Mon 8:00" },
  { category: "Tips & how-to", color: "#34d399", title: "3 hooks that actually work", type: "Carousel", channel: "LinkedIn", channelColor: "#0A66C2", when: "Tue 9:30" },
  { category: "Product launches", color: "#fb923c", title: "Spring drop is live", type: "Grid", channel: "Instagram", channelColor: "#E1306C", when: "Wed 12:00" },
  { category: "Campaigns", color: "#8b5cf6", title: "Awareness week, day one", type: "Story", channel: "Facebook", channelColor: "#1877F2", when: "Thu 10:00" },
  { category: "Promotions", color: "#f59e0b", title: "48-hour early access", type: "Grid", channel: "X", channelColor: "#0f0f0f", when: "Fri 17:00" },
  { category: "Client wins", color: "#ec4899", title: "Case study: +40% reach", type: "Carousel", channel: "LinkedIn", channelColor: "#0A66C2", when: "Sat 11:00" },
  { category: "Awareness days", color: "#10b981", title: "World refugee day", type: "Grid", channel: "Website", channelColor: "#10b981", when: "Sun 9:00" },
]

function PostCard({ post }: { post: DeckPost }) {
  return (
    <article className="w-[208px] overflow-hidden rounded-2xl bg-card text-card-foreground shadow-[0_18px_50px_rgba(0,0,0,0.35)] ring-1 ring-black/5">
      <div
        className="relative h-24"
        style={{ backgroundColor: `${post.color}33` }}
      >
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-card/95 px-2 py-0.5 text-[11px] font-medium">
          <span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: post.color }}
          />
          {post.category}
        </span>
        <span className="absolute bottom-2.5 right-3 text-[10px] font-medium text-muted-foreground">
          {post.type}
        </span>
      </div>
      <div className="p-3.5">
        <p className="text-[13px] font-semibold leading-snug">{post.title}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: post.channelColor }}
            />
            {post.channel}
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {post.when}
          </span>
        </div>
      </div>
    </article>
  )
}

export function PostDeck() {
  const root = useRef<HTMLElement>(null)
  const pin = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const mid = (DECK.length - 1) / 2

      gsap.set(".deck-card", {
        xPercent: -50,
        transformOrigin: "bottom center",
        x: (i: number) => (i - mid) * 64,
        y: (i: number) => Math.abs(i - mid) * 18,
        rotate: (i: number) => (i - mid) * 7,
        zIndex: (i: number) => 20 - Math.round(Math.abs(i - mid)),
      })

      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".deck-card", {
          x: 0,
          y: 28,
          rotate: 0,
          scale: 0.9,
          autoAlpha: 0,
          ease: "power3.out",
          stagger: { each: 0.05, from: "center" },
          scrollTrigger: {
            trigger: root.current,
            scroller: landingScroller(root.current),
            start: "top top",
            end: "+=120%",
            scrub: 0.6,
            pin: pin.current,
          },
        })
      })
    },
    { scope: root }
  )

  return (
    <section
      ref={root}
      id="posts"
      className="relative scroll-mt-16 overflow-hidden bg-[#0e2117] px-6 text-white"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(52,211,153,0.18),transparent_55%)]"
      />
      <div
        ref={pin}
        className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center py-24"
        style={{ perspective: "1300px" }}
      >
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-emerald-300/80">
            Every post, every brand
          </p>
          <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight">
            A month of content, fanned out in one calm deck
          </h2>
          <p className="mt-4 text-pretty text-white/60">
            Plan across every channel, colour-coded by category. Scroll and watch
            the whole queue spread out - drafted, scheduled and waiting on the one
            approval that matters: yours.
          </p>
        </div>

        <div className="relative mt-16 h-[320px] w-full">
          {DECK.map((post, i) => (
            <div key={i} className="deck-card absolute left-1/2 top-0">
              <PostCard post={post} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
