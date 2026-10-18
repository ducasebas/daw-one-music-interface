import { test, expect } from "@playwright/test";
test("production shell reloads offline and settings remain editable", async ({
  page,
  context,
}) => {
  await page.goto("/?screen=1");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Weightless" })).toBeVisible();
  await expect(page.locator(".status")).toContainText("OFFLINE PREVIEW");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Manual video correction").fill("42");
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Manual video correction")).toHaveValue("42");
});
