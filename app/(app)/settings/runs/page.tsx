import { redirect } from "next/navigation"

/*
 * Phase B: `/settings/runs` is replaced by the Studio activity stream.
 * Kept as a redirect so any external bookmark or in-app link still lands
 * users in the right place.
 */
export default function SettingsRunsRedirect() {
  redirect("/studio")
}
