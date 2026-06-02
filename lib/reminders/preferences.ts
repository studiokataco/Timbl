import type { ReminderPreferences } from "@/lib/schemas/organisation"

export const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
  enabled: true,
  approvalDue: true,
  overdue: true,
  goesLiveSoon: true,
  silentCategory: true,
  maxToastsPerSession: 3,
  frequency: "per-session",
  approvalHorizonDays: 3,
  silentCategoryDays: 14,
  goesLiveWindow: "today-and-tomorrow",
  overdueIncludeDraft: true,
  overdueIncludeScheduled: true,
}

export function resolveReminderPreferences(
  stored?: Partial<ReminderPreferences> | null,
): ReminderPreferences {
  const d = DEFAULT_REMINDER_PREFERENCES
  return {
    enabled: stored?.enabled ?? d.enabled,
    approvalDue: stored?.approvalDue ?? d.approvalDue,
    overdue: stored?.overdue ?? d.overdue,
    goesLiveSoon: stored?.goesLiveSoon ?? d.goesLiveSoon,
    silentCategory: stored?.silentCategory ?? d.silentCategory,
    maxToastsPerSession: stored?.maxToastsPerSession ?? d.maxToastsPerSession,
    frequency: stored?.frequency ?? d.frequency,
    approvalHorizonDays: stored?.approvalHorizonDays ?? d.approvalHorizonDays,
    silentCategoryDays: stored?.silentCategoryDays ?? d.silentCategoryDays,
    goesLiveWindow: stored?.goesLiveWindow ?? d.goesLiveWindow,
    overdueIncludeDraft: stored?.overdueIncludeDraft ?? d.overdueIncludeDraft,
    overdueIncludeScheduled:
      stored?.overdueIncludeScheduled ?? d.overdueIncludeScheduled,
  }
}
