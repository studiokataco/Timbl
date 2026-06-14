"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SettingDisclosure } from "@/components/settings/setting-disclosure"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateReminderSettings } from "@/lib/actions/reminder-settings"
import {
  GOES_LIVE_WINDOW_LABELS,
  REMINDER_FREQUENCY_LABELS,
  labelOr,
} from "@/lib/labels/enums"
import type { ReminderPreferences } from "@/lib/schemas/organisation"

type KindKey = keyof Pick<
  ReminderPreferences,
  "approvalDue" | "overdue" | "goesLiveSoon" | "silentCategory"
>

const KIND_ROWS: {
  key: KindKey
  label: string
  description: string
  testTitle: string
  testDescription: string
}[] = [
  {
    key: "approvalDue",
    label: "Drafts needing review",
    description: "Agent drafts still pending approval before their slot.",
    testTitle: "1 draft needs review",
    testDescription: "Scheduled in the next 3 days",
  },
  {
    key: "overdue",
    label: "Overdue posts",
    description: "Posts whose scheduled date has already passed.",
    testTitle: "Overdue post",
    testDescription: "Scheduled date has passed",
  },
  {
    key: "goesLiveSoon",
    label: "Publish readiness",
    description: "Scheduled posts going live soon with incomplete channels.",
    testTitle: "Final check before publish",
    testDescription: "Channels still need setup",
  },
  {
    key: "silentCategory",
    label: "Quiet categories",
    description: "Categories with no recent posts, nudging you to plan content.",
    testTitle: "Plan a category post",
    testDescription: "No posts in 14+ days",
  },
]

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function ReminderSettings({
  initial,
}: {
  initial: ReminderPreferences
}) {
  const [prefs, setPrefs] = useState(initial)
  const [pending, startTransition] = useTransition()

  function patch(next: Partial<ReminderPreferences>) {
    setPrefs((prev) => ({ ...prev, ...next }))
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateReminderSettings(prefs)
      if (!result.ok) {
        toast.error("Could not save notification settings")
        return
      }
      toast.success("Notification settings saved")
    })
  }

  function sendTestToast(kind: KindKey) {
    const row = KIND_ROWS.find((r) => r.key === kind)
    if (!row) return
    toast(row.testTitle, {
      description: row.testDescription,
      action: { label: "Preview", onClick: () => {} },
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border p-4 space-y-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="reminders-enabled"
            checked={prefs.enabled}
            disabled={pending}
            onCheckedChange={(v) => patch({ enabled: v === true })}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <Label htmlFor="reminders-enabled" className="text-sm font-medium">
              Show reminder toasts
            </Label>
            <p className="text-xs text-muted-foreground">
              Occasional toasts when you open the app. Turn off to hide all
              workspace reminders.
            </p>
          </div>
        </div>

        {prefs.enabled ? (
          <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <Label htmlFor="reminder-frequency" className="text-xs">
                How often
              </Label>
              <Select
                value={prefs.frequency}
                onValueChange={(v) =>
                  patch({
                    frequency: v as ReminderPreferences["frequency"],
                  })
                }
                disabled={pending}
              >
                <SelectTrigger id="reminder-frequency" className="h-9">
                  <SelectValue>
                    {(v) => labelOr(REMINDER_FREQUENCY_LABELS, v)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per-session">
                    Each browser session
                  </SelectItem>
                  <SelectItem value="once-per-day">Once per day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reminder-max" className="text-xs">
                Max toasts per visit
              </Label>
              <Select
                value={String(prefs.maxToastsPerSession)}
                onValueChange={(v) =>
                  patch({ maxToastsPerSession: Number(v) })
                }
                disabled={pending}
              >
                <SelectTrigger id="reminder-max" className="h-9">
                  <SelectValue>
                    {(v) => {
                      const n = Number(v)
                      if (!n) return ""
                      return n === 1 ? "1 toast" : `${n} toasts`
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}
      </section>

      {prefs.enabled ? (
        <SettingDisclosure
          title="Reminder types"
          summary={`${KIND_ROWS.filter((r) => prefs[r.key]).length} of ${KIND_ROWS.length} on - tune when each one fires`}
        >
          <ul className="space-y-2">
            {KIND_ROWS.map((row) => (
              <li key={row.key}>
                <SettingDisclosure
                  title={row.label}
                  summary={prefs[row.key] ? `On - ${row.description}` : "Off"}
                >
                <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`reminder-${row.key}`}
                    checked={prefs[row.key]}
                    disabled={pending}
                    onCheckedChange={(v) => patch({ [row.key]: v === true })}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <Label
                      htmlFor={`reminder-${row.key}`}
                      className="text-sm font-medium"
                    >
                      Show this reminder
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {row.description}
                    </p>
                  </div>
                </div>

                {prefs[row.key] ? (
                  <div className="pl-7 space-y-3 border-t border-border/60 pt-3">
                    {row.key === "approvalDue" ? (
                      <div className="space-y-1.5 max-w-[12rem]">
                        <Label htmlFor="approval-horizon" className="text-xs">
                          Days before scheduled date
                        </Label>
                        <Input
                          id="approval-horizon"
                          type="number"
                          min={1}
                          max={14}
                          disabled={pending}
                          value={prefs.approvalHorizonDays}
                          onChange={(e) =>
                            patch({
                              approvalHorizonDays: clampInt(
                                Number(e.target.value) || 1,
                                1,
                                14,
                              ),
                            })
                          }
                        />
                      </div>
                    ) : null}

                    {row.key === "overdue" ? (
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="overdue-draft"
                            checked={prefs.overdueIncludeDraft}
                            disabled={pending}
                            onCheckedChange={(v) =>
                              patch({ overdueIncludeDraft: v === true })
                            }
                          />
                          <Label htmlFor="overdue-draft" className="text-xs">
                            Draft posts
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="overdue-scheduled"
                            checked={prefs.overdueIncludeScheduled}
                            disabled={pending}
                            onCheckedChange={(v) =>
                              patch({ overdueIncludeScheduled: v === true })
                            }
                          />
                          <Label
                            htmlFor="overdue-scheduled"
                            className="text-xs"
                          >
                            Scheduled posts
                          </Label>
                        </div>
                      </div>
                    ) : null}

                    {row.key === "goesLiveSoon" ? (
                      <div className="space-y-1.5 max-w-xs">
                        <Label htmlFor="goes-live-window" className="text-xs">
                          Remind when slot is
                        </Label>
                        <Select
                          value={prefs.goesLiveWindow}
                          onValueChange={(v) =>
                            patch({
                              goesLiveWindow:
                                v as ReminderPreferences["goesLiveWindow"],
                            })
                          }
                          disabled={pending}
                        >
                          <SelectTrigger id="goes-live-window" className="h-9">
                            <SelectValue>
                              {(v) => labelOr(GOES_LIVE_WINDOW_LABELS, v)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="today">Today only</SelectItem>
                            <SelectItem value="today-and-tomorrow">
                              Today or tomorrow
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}

                    {row.key === "silentCategory" ? (
                      <div className="space-y-1.5 max-w-[12rem]">
                        <Label htmlFor="silent-days" className="text-xs">
                          Days without a post
                        </Label>
                        <Input
                          id="silent-days"
                          type="number"
                          min={7}
                          max={90}
                          disabled={pending}
                          value={prefs.silentCategoryDays}
                          onChange={(e) =>
                            patch({
                              silentCategoryDays: clampInt(
                                Number(e.target.value) || 7,
                                7,
                                90,
                              ),
                            })
                          }
                        />
                      </div>
                    ) : null}

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => sendTestToast(row.key)}
                    >
                      Send test toast
                    </Button>
                  </div>
                ) : null}
                </div>
                </SettingDisclosure>
              </li>
            ))}
          </ul>
        </SettingDisclosure>
      ) : null}

      <Button size="sm" onClick={handleSave} disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </div>
  )
}
