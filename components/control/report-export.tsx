"use client"

import { useTransition } from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { tenantsReportCsv } from "@/lib/actions/platform/reports"

export function ReportExport() {
  const [pending, start] = useTransition()

  const download = () =>
    start(async () => {
      const res = await tenantsReportCsv()
      if (!res.ok || !res.csv) {
        toast.error(`Export failed: ${res.error ?? "unknown"}`)
        return
      }
      const blob = new Blob([res.csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `tenants-financials-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Report downloaded")
    })

  return (
    <Button size="sm" variant="outline" onClick={download} disabled={pending}>
      <Download className="size-4" />
      {pending ? "Preparing..." : "Export CSV"}
    </Button>
  )
}
