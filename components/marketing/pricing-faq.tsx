"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

import { Reveal } from "./reveal"

const FAQS = [
  {
    q: "Can I buy a plan straight away?",
    a: "Yes. Pick Studio or Agency, sign in with Google and pay through Razorpay. Your workspace is created the moment payment is confirmed and you land in a short setup wizard. Prefer to start free? Request free access and we will send you an invite.",
  },
  {
    q: "How does the free trial work?",
    a: "Free workspaces can start a 30-day Agency trial once, from Plan and billing, with no card needed. When the trial ends the workspace returns to the Free plan automatically and nothing is charged.",
  },
  {
    q: "How does billing work?",
    a: "Paid plans are billed monthly in advance in Indian rupees through Razorpay, by card, UPI or netbanking. The subscription renews each month until you cancel, and Razorpay emails a receipt for every charge.",
  },
  {
    q: "Can I cancel, and do you offer refunds?",
    a: "Cancel anytime from Plan and billing. You keep your plan until the end of the period you have paid for, then move to Free. We do not refund partial months, but we refund duplicate or mistaken charges in full. See our refund policy for details.",
  },
  {
    q: "What counts as an AI agent run?",
    a: "One run is one agent invocation: a draft, a rewrite or a research pass. Runs are counted per workspace and reset at the start of each billing period.",
  },
  {
    q: "Can I manage more brands than my plan includes?",
    a: "Studio includes 1 brand, Agency includes 3 and Scale includes 10. To manage more brands, move up a plan or talk to us about Scale.",
  },
  {
    q: "Is my content used to train AI models?",
    a: "No. Your content is sent to our AI providers only to generate what you ask for, and they are contractually barred from training on it. Nothing is published without a person approving it.",
  },
  {
    q: "Can I plug Timbl into my own tools?",
    a: "Yes. Every paid plan includes MCP, CLI and API access, so your team and your agents can read and write the calendar from wherever they already work.",
  },
  {
    q: "What does Scale add on top of Agency?",
    a: "Unlimited AI agent runs and scheduled posts, 10 brands, more seats, SSO, an audit log, an SLA and 24/7 priority support. Pricing is tailored to your organisation, so reach out and we will put a plan together.",
  },
]

export function PricingFaq() {
  const [open, setOpen] = useState(0)

  return (
    <section aria-labelledby="pricing-faq-heading" className="px-6 pb-24 md:pb-32">
      <Reveal className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16">
          <div>
            <h2 id="pricing-faq-heading" className="text-3xl tracking-tight md:text-4xl">
              <span className="font-normal">Questions, </span>
              <span className="font-bold">answered</span>
            </h2>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground md:text-base">
              Anything else about plans, billing or migrations - we reply fast.
            </p>
            <Link
              href="mailto:hello@kataco.in?subject=Timbl%20pricing%20question"
              className="mt-6 inline-flex h-11 items-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Ask us anything
            </Link>
          </div>

          <div>
            {FAQS.map((faq, i) => {
              const isOpen = open === i
              return (
                <div
                  key={faq.q}
                  className={cn("border-b border-hairline", i === 0 && "border-t")}
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`pricing-faq-panel-${i}`}
                    id={`pricing-faq-trigger-${i}`}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-medium transition-colors hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-lg"
                  >
                    {faq.q}
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        "size-5 shrink-0 text-muted-foreground transition-transform duration-300 motion-reduce:transition-none",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                  <div
                    id={`pricing-faq-panel-${i}`}
                    role="region"
                    aria-labelledby={`pricing-faq-trigger-${i}`}
                    className={cn(
                      "grid transition-all duration-300 ease-out motion-reduce:transition-none",
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="max-w-[65ch] pb-5 text-sm leading-6 text-body md:text-[15px]">
                        {faq.a}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Reveal>
    </section>
  )
}
