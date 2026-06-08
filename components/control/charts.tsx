"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { usd } from "@/lib/platform/format"

/*
 * Control-centre charts - efferd-style visuals built on recharts and wired
 * to our design tokens (--color-chart-1..5 from app/globals.css, which map to
 * the signature coral/pink/violet/emerald/blue palette). Client components:
 * recharts renders in the browser only.
 */

const PALETTE = [
  "var(--color-chart-5)",
  "var(--color-chart-1)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-2)",
]

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--color-popover, #fff)",
  border: "1px solid color-mix(in oklab, currentColor 12%, transparent)",
  borderRadius: 8,
  fontSize: 12,
  padding: "6px 10px",
  color: "var(--color-popover-foreground, #111)",
}

export interface TrendPoint {
  date: string
  usd: number
}

export function SpendTrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return <EmptyChart label="No spend history yet" />
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-5)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-chart-5)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => d.slice(5)}
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          tickFormatter={(v: number) => usd(v)}
          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v) => [usd(Number(v) || 0), "spend"] as [string, string]}
          labelFormatter={(l) => `Day ${l}`}
        />
        <Area
          type="monotone"
          dataKey="usd"
          stroke="var(--color-chart-5)"
          strokeWidth={2}
          fill="url(#spendFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export interface Slice {
  name: string
  value: number
}

export function CostDonut({ data }: { data: Slice[] }) {
  const slices = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value)
  if (slices.length === 0) {
    return <EmptyChart label="No cost recorded yet" />
  }
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="50%" height={200}>
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius={52}
            outerRadius={80}
            paddingAngle={2}
            stroke="var(--color-background)"
            strokeWidth={2}
          >
            {slices.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => usd(Number(v) || 0)} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex flex-1 flex-col gap-1.5 text-sm">
        {slices.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: PALETTE[i % PALETTE.length] }}
            />
            <span className="flex-1 truncate text-muted-foreground" title={s.name}>
              {s.name}
            </span>
            <span className="tabular-nums">{usd(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export interface HourBar {
  hour: string
  runs: number
  failed: number
}

export function ThroughputChart({ data }: { data: HourBar[] }) {
  const hasData = data.some((d) => d.runs > 0)
  if (!hasData) return <EmptyChart label="No runs in the last 24h" />
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barCategoryGap={2}>
        <XAxis
          dataKey="hour"
          tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          interval={3}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          width={28}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "color-mix(in oklab, currentColor 6%, transparent)" }}
        />
        <Bar dataKey="runs" stackId="a" fill="var(--color-chart-5)" radius={[2, 2, 0, 0]} name="runs" />
        <Bar dataKey="failed" stackId="b" fill="var(--color-destructive, #ef4444)" radius={[2, 2, 0, 0]} name="failed" />
      </BarChart>
    </ResponsiveContainer>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}
