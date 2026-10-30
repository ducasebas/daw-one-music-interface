import { test, expect } from "@playwright/test";
test("GUI2 music journey works at 1280x400 through the shared runtime", async ({
  page,
}) => {
  await page.request.post("/api/scenario", { data: { name: "Playback" } });
  await page.goto("/?gui=2&product=1");
  await page.getByRole("button", { name: "Mijn muziek", exact: true }).click();
  await page.getByRole("button", { name: "Dive Tycho" }).click();
  await page.getByRole("button", { name: "Als volgende", exact: true }).click();
  await page.getByRole("button", { name: "Wachtrij", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/state")).json()).playback.queue
          .length,
    )
    .toBe(4);
  await page.getByRole("button", { name: "A Walk Tycho" }).first().click();
  await expect
    .poll(async () => {
      const s = await (await page.request.get("/api/state")).json();
      return s.playback.queue[s.playback.index].title;
    })
    .toBe("A Walk");
  await page.getByRole("button", { name: "Zoeken", exact: true }).click();
  for (const k of "tycho")
    await page.getByRole("button", { name: `Toets ${k}`, exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Zoek muziek" })).toHaveValue(
    "tycho",
  );
  await expect(
    page.getByRole("button", { name: "A Walk Tycho ›" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Kamers", exact: true }).click();
  await page.getByRole("button", { name: "Probeer voorbeeldgroep" }).click();
  await expect(page.getByText("Voorbeeldgroep met TuneBox")).toBeVisible();
  await expect(
    page.getByText("Rivo-bediening is uitsluitend", { exact: false }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    400,
  );
  await page.getByRole("button", { name: "Ontdek", exact: true }).click();
  await page.screenshot({ path: "test-results/gui2-discover.png" });
});
test("GUI2 all sections fit the native screen, use shared settings and show faults", async ({
  page,
}) => {
  await page.request.post("/api/scenario", { data: { name: "Playback" } });
  await page.goto("/?gui=2&screen=1&display=dsi-production");
  for (const name of [
    "Ontdek",
    "Mijn muziek",
    "Zoeken",
    "Wachtrij",
    "Kamers",
    "Instellingen",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    const b = await page.locator(".music2").boundingBox();
    expect(b.width).toBe(1280);
    expect(b.height).toBe(400);
    expect(
      await page
        .locator(".m2-content")
        .evaluate((e) => e.scrollHeight <= e.clientHeight + 1),
    ).toBeTruthy();
  }
  await page.getByLabel("Settings page", { exact: true }).selectOption("1");
  await expect(page.getByLabel("Skin", { exact: true })).toBeVisible();
  await page.request.post("/api/event", { data: { type: "amplifier-fault" } });
  await expect(page.locator(".m2-player-status")).toContainText("Apparaatfout");
  const state = await (await page.request.get("/api/state")).json();
  expect(state.device.amplifierEnabled).toBe(false);
  await page.getByRole("button", { name: "Open Nu spelen" }).click();
  await page
    .getByRole("button", { name: "Video Artwork", exact: true })
    .click();
  await expect(page.getByText("END-SYNC · MOCK")).toBeVisible();
});
