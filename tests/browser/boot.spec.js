import { test, expect } from "@playwright/test";
import { chooseSkin } from "./skin-helpers.js";
test.beforeEach(async ({ page }) => {
  await page.request.post("/api/boot/settings", {
    data: { radioEnabled: false },
  });
  await page.request.post("/api/event", {
    data: { type: "startup-signal", key: "pdWatts", value: 100 },
  });
  await page.request.post("/api/event", {
    data: { type: "startup-signal", key: "fanExpected", value: false },
  });
  await page.request.post("/api/scenario", { data: { name: "Playback" } });
});
test.afterEach(async ({ page }) => {
  await page.request.post("/api/boot/settings", {
    data: { radioEnabled: false },
  });
  await page.request.post("/api/scenario", { data: { name: "Playback" } });
});
test("all skins show paged startup checks and saved autoradio without scrolling at 1280x400", async ({
  page,
}) => {
  await page.goto("/?gui=2&product=1");
  for (const skin of [
    "reference-dark",
    "minimal-dark",
    "warm-bronze",
    "champagne-gold",
    "cinematic",
    "nerd-mode",
  ]) {
    await chooseSkin(page, skin);
    await page
      .getByRole("button", { name: "Open opstartcontrole", exact: true })
      .click();
    await expect(page.getByLabel("Settings page", { exact: true })).toHaveValue(
      "11",
    );
    for (let i = 0; i < 4; i++) {
      await page
        .getByLabel("Boot page", { exact: true })
        .selectOption(String(i));
      const fits = await page
        .locator(".boot-panel")
        .evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
      expect(fits, `${skin} boot page ${i}`).toBe(true);
      expect(
        await page
          .locator(".boot-panel .page-body")
          .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
        `${skin} inner page ${i}`,
      ).toBe(true);
      expect(
        await page.evaluate(() => document.documentElement.scrollHeight),
      ).toBe(400);
    }
  }
  await page.getByLabel("Autoradio bij koude boot").check();
  await page.getByLabel("Voorbeeldstation").selectOption("classical");
  await page
    .getByRole("button", { name: "Opstartinstellingen opslaan", exact: true })
    .click();
  await expect(
    page.getByText("Opgeslagen · geldt vanaf volgende koude simulatieboot"),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Open opstartcontrole", exact: true })
    .click();
  await page.getByLabel("Boot page", { exact: true }).selectOption("3");
  await expect(page.getByLabel("Autoradio bij koude boot")).toBeChecked();
  await expect(page.getByLabel("Voorbeeldstation")).toHaveValue("classical");
});
test("low PD and offline results stay accessible and inhibit the shared amplifier", async ({
  page,
}) => {
  await page.goto("/?gui=2&product=1&profile=pi3");
  await page.request.post("/api/event", {
    data: { type: "startup-signal", key: "pdWatts", value: 60 },
  });
  await page
    .getByRole("button", { name: "Open opstartcontrole", exact: true })
    .click();
  await expect(
    page.getByText("60 W contract · minder dan 100 W"),
  ).toBeVisible();
  const state = await (await page.request.get("/api/state")).json();
  expect(state.device.amplifierEnabled).toBe(false);
  await page.request.post("/api/event", {
    data: { type: "wifi", value: false },
  });
  await page.getByLabel("Boot page", { exact: true }).selectOption("2");
  await expect(
    page.getByText("Geen netwerkverbinding", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
});

test("backend loss marks startup telemetry unknown and prevents saving server settings", async ({
  page,
}) => {
  await page.goto("/?gui=2&product=1");
  await page
    .getByRole("button", { name: "Open opstartcontrole", exact: true })
    .click();
  await page.context().setOffline(true);
  await expect(
    page
      .getByText("Backend offline · actuele status onbekend", { exact: true })
      .first(),
  ).toBeVisible({ timeout: 10000 });
  await page.getByLabel("Boot page", { exact: true }).selectOption("3");
  await expect(
    page.getByRole("button", {
      name: "Opstartinstellingen opslaan",
      exact: true,
    }),
  ).toBeDisabled();
  await page.context().setOffline(false);
});
