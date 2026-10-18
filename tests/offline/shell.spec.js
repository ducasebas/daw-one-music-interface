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

for (const mode of ["hdmi-development", "dsi-production"]) {
  test(`production ${mode} uses shared 1280x400 product and all six skins`, async ({
    page,
  }) => {
    await page.request.post("/api/scenario", { data: { name: "Cold boot" } });
    await page.request.post("/api/event", {
      data: { type: "volume", value: 32 },
    });
    await page.setViewportSize(
      mode === "hdmi-development"
        ? { width: 1920, height: 1080 }
        : { width: 1280, height: 400 },
    );
    await page.goto(`/?screen=1&display=${mode}`);
    await expect(page.locator(".display-viewport")).toHaveAttribute(
      "data-display-mode",
      mode,
    );
    await expect(page.getByLabel("Separate hardware test panel")).toHaveCount(
      0,
    );
    await expect
      .poll(() =>
        page.locator("main").evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        }),
      )
      .toEqual(
        mode === "hdmi-development"
          ? { x: 320, y: 340, width: 1280, height: 400 }
          : { x: 0, y: 0, width: 1280, height: 400 },
      );
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Pause", exact: true }),
    ).toBeVisible();
    const volume = page.getByRole("slider", { name: "Volume", exact: true });
    await volume.focus();
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(
        async () =>
          (await (await page.request.get("/api/state")).json()).audio.volume,
      )
      .toBe(33);
    for (const skin of [
      "reference-dark",
      "minimal-dark",
      "warm-bronze",
      "champagne-gold",
      "cinematic",
      "nerd-mode",
    ]) {
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.getByLabel("Settings page", { exact: true }).selectOption("1");
      await page.getByLabel("Skin", { exact: true }).selectOption(skin);
      await page
        .getByRole("button", { name: "Now playing", exact: true })
        .click();
      await expect(page.locator("main")).toHaveAttribute("data-layout", skin);
      expect(
        await page
          .locator("main")
          .evaluate((e) => [e.offsetWidth, e.offsetHeight]),
      ).toEqual([1280, 400]);
    }
    if (mode === "hdmi-development") {
      await page.setViewportSize({ width: 1024, height: 768 });
      await expect
        .poll(() =>
          page
            .locator("main")
            .evaluate((e) => Math.round(e.getBoundingClientRect().width)),
        )
        .toBe(1024);
      expect(
        await page
          .locator("main")
          .evaluate((e) => [e.offsetWidth, e.offsetHeight]),
      ).toEqual([1280, 400]);
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto("/?screen=1&display=dsi-production");
      await expect(
        page.getByRole("button", { name: "Pause", exact: true }),
      ).toBeVisible();
      expect(
        (await (await page.request.get("/api/state")).json()).audio.volume,
      ).toBe(33);
    }
  });
}
