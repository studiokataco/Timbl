import Link from "next/link"
import { ArrowRight, Check, Minus } from "lucide-react"

export type CompareValue = string | boolean | null

export type CompareRow = {
  label: string
  values: CompareValue[]
}

export type CompareGroup = {
  title: string
  rows: CompareRow[]
}

export type ComparePlanColumn = {
  id: string
  label: string
  priceLabel: string
  hex: string | null
  cta: { label: string; href: string }
}

function CellValue({ value, hex }: { value: CompareValue; hex: string | null }) {
  if (value === true) {
    return (
      <Check
        aria-label="Included"
        className="size-5"
        style={hex ? { color: hex } : undefined}
      />
    )
  }
  if (value === false || value === null) {
    return <Minus aria-label="Not included" className="size-5 text-muted-foreground/50" />
  }
  return <span className="text-sm text-body">{value}</span>
}

export function PricingCompare({
  plans,
  groups,
}: {
  plans: ComparePlanColumn[]
  groups: CompareGroup[]
}) {
  return (
    <section aria-labelledby="compare-plans-heading" className="px-6 pb-24 md:pb-32">
      <div className="mx-auto max-w-6xl">
        <h2
          id="compare-plans-heading"
          className="text-3xl tracking-tight md:text-4xl"
        >
          <span className="font-normal">Compare </span>
          <span className="font-bold">plans and features</span>
        </h2>
        <p className="mt-3 max-w-md text-sm text-muted-foreground md:text-base">
        Choose a plan that’s packed with the best features for engaging your audience, managing your brand, and driving results for your businesses.
        </p>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[612px] table-fixed border-collapse md:min-w-[720px]">
            <thead>
              <tr className="border-b border-hairline">
                <th className="sticky left-0 z-10 w-[132px] bg-background md:static md:w-[32%]" aria-hidden />
                {plans.map((plan) => (
                  <th key={plan.id} className="w-[120px] px-3 pb-5 text-left align-top md:w-auto">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="size-2 rounded-full"
                        style={{
                          background: plan.hex ?? "var(--foreground)",
                        }}
                      />
                      <span className="text-base font-semibold">{plan.label}</span>
                    </span>
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">
                      {plan.priceLabel}
                    </span>
                    <Link
                      href={plan.cta.href}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                      style={plan.hex ? { color: plan.hex } : undefined}
                    >
                      {plan.cta.label}
                      <ArrowRight aria-hidden className="size-3.5" />
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.title}>
                <tr>
                  <th
                    colSpan={plans.length + 1}
                    className="pb-3 pt-10 text-left text-sm font-semibold"
                  >
                    <span className="sticky left-0">{group.title}</span>
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.label} className="border-b border-hairline-soft">
                    <td className="sticky left-0 z-10 bg-background py-3.5 pr-4 text-sm text-muted-foreground md:static">
                      {row.label}
                    </td>
                    {row.values.map((value, i) => (
                      <td key={plans[i]?.id ?? i} className="px-3 py-3.5">
                        <CellValue value={value} hex={plans[i]?.hex ?? null} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </div>
    </section>
  )
}
