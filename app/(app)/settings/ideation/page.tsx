import { redirect } from "next/navigation"

/*
 * Phase D — /settings/ideation has been folded into /studio. The old
 * card-grid client (./client.tsx) is left intact for one cleanup pass
 * but no longer reachable from the app's UI.
 */
export default function SettingsIdeationRedirect() {
  redirect("/studio")
}
