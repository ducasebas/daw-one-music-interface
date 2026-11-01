import { test, expect } from "@playwright/test";
test("Pi3 profile shares playback and skins with video disabled and a fixed viewport", async ({
  page,
}) => {
  await page.request.post("/api/scenario", { data: { name: "Playback" } });
  await page.goto("/?gui=2&product=1&profile=pi3");
  await expect(page.locator(".music2")).toHaveAttribute(
    "data-performance",
    "pi3",
  );
  await expect(page.locator("video")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Open Nu spelen", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Video uit · Pi 3 modus" }),
  ).toBeDisabled();
  expect(
    await page
      .locator(".music2")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    400,
  );
  await page.getByRole("button", { name: "Instellingen", exact: true }).click();
  await page.getByLabel("Settings page", { exact: true }).selectOption("1");
  const picker = page.getByLabel("Skin", { exact: true });
  const ids = await picker
    .locator("option")
    .evaluateAll((options) => options.map((o) => o.value));
  for (const id of ids) {
    await picker.selectOption(id);
    await expect(page.locator(".music2")).toHaveAttribute(
      "data-performance",
      "pi3",
    );
  }
  await expect(page.locator("video")).toHaveCount(0);
  const state = await (await page.request.get("/api/state")).json();
  expect(state.playback.queue.length).toBeGreaterThan(0);
});
