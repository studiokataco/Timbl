import { test, expect } from "@playwright/test"

/*
 * Phase 7 smoke. Runs against the local dev stack (emulator + dev shim),
 * which means real Google OAuth is bypassed by the shim and we exercise
 * the rendered shell instead.
 *
 * For the real prod login flow, set PLAYWRIGHT_BASE_URL to the App Hosting
 * URL and remove the dev-shim early return. That run is gated on a real
 * Google account — it cannot run unattended in CI.
 */

test("app shell renders and the calendar route loads", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/\/(calendar|login)/)

  if (page.url().includes("/login")) {
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible()
    return
  }

  await expect(page.getByRole("navigation")).toBeVisible()
})
