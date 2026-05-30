import { redirect } from "next/navigation"

/*
 * Phase C - Agents settings now live inside `/studio` as the playground
 * inspector panel. This route stays alive as a redirect for any in-flight
 * bookmarks or links.
 */
export default function SettingsAgentsRedirect() {
  redirect("/studio")
}
