import { chooseSkin } from "./skin-helpers.js";
import { test, expect } from "@playwright/test";
test("sensor readouts are distinct from simulation and become unknown offline", async ({
  page,
  context,
}) => {
  const state = await (await page.request.get("/api/state")).json();
  state.hardwareTelemetry = {
    enabled: true,
    temperature: { status: "ok", value: 19.5 },
    light: { status: "ok", value: 485.74848 },
    amplifierVerified: false,
  };
  await page.route("**/api/state", (r) => r.fulfill({ json: state }));
  await page.route("**/api/events", (r) =>
    r.fulfill({
      contentType: "text/event-stream",
      body: `data: ${JSON.stringify(state)}\n\n`,
    }),
  );
  await page.goto("/?gui=2&product=1");
  await page
    .getByRole("button", { name: "Open system status", exact: true })
    .click();
  await page.getByLabel("Boot page", { exact: true }).selectOption("4");
  await expect(page.getByLabel("Echte sensormetingen")).toContainText("19.5");
  await expect(page.getByLabel("Echte sensormetingen")).toContainText("486");
  for (const i of [0, 1, 2, 4]) {
    await page.getByLabel("Boot page", { exact: true }).selectOption(String(i));
    expect(
      await page
        .locator(".boot-panel .page-body")
        .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
    ).toBe(true);
  }
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
      .getByRole("button", { name: "Open system status", exact: true })
      .click();
    await page.getByLabel("Boot page", { exact: true }).selectOption("4");
    await expect(
      page.getByRole("article", { name: "Ambient temperature", exact: true }),
    ).toContainText("19.5 °C");
    await expect(
      page.getByRole("article", { name: "Ambient light", exact: true }),
    ).toContainText("486 lux");
    expect(
      await page
        .locator(".boot-panel .page-body")
        .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
    ).toBe(true);
  }
  try {
    await page.route("**/api/**", (r) => r.abort());
    await context.setOffline(true);
    await expect(page.getByLabel("Echte sensormetingen")).toContainText(
      "unknown",
      { timeout: 10000 },
    );
  } finally {
    await context.setOffline(false);
  }
});
