import { test, expect } from "@playwright/test"

/*
 * Full feedback journey: sidebar trigger -> dialog -> submit -> success
 * toast. Server-side effects (Firestore write, platform signal, thank-you
 * email) are verified separately against the emulator/Resend, since this
 * spec only proves the client -> server action wiring renders correctly.
 */

test("send feedback from the sidebar completes with a thank-you toast", async ({ page }) => {
  // Skip the first-visit product tour (driver.js) - its overlay intercepts
  // pointer events and would otherwise block the sidebar click below.
  await page.addInitScript(() => {
    window.localStorage.setItem("timbl.tour.completed.v1", new Date().toISOString())
  })
  await page.goto("/calendar")

  const trigger = page.getByRole("button", { name: "Send feedback" })
  await expect(trigger).toBeVisible()
  await trigger.click()

  const dialog = page.getByRole("dialog", { name: "Send feedback" })
  await expect(dialog).toBeVisible()

  await dialog.getByLabel("Your feedback").fill("Playwright E2E: verifying the full feedback journey.")
  await dialog.getByRole("button", { name: "Send feedback" }).click()

  await expect(page.getByText("Thanks for the feedback - check your inbox")).toBeVisible({
    timeout: 15000,
  })
  await expect(dialog).not.toBeVisible()
})
