import { test, expect } from "@playwright/test";
test("1280 × 400 layout, touch controls, navigation, artwork and persistence", async ({
  page,
}) => {
  await page.request.post("/api/scenario", { data: { name: "Cold boot" } });
  await page.goto("/");
  await expect(page.getByText("SIMULATED SYSTEM")).toBeVisible();
  await page.getByRole("button", { name: "Play", exact: true }).tap();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next track" }).click();
  await expect(page.getByRole("heading", { name: "A Walk" })).toBeVisible();
  await page
    .getByRole("button", { name: "Video artwork", exact: false })
    .click();
  await expect(page.getByText("VIDEO ARTWORK · MOCK")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    1280,
  );
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    400,
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Manual video correction").fill("12");
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Manual video correction")).toHaveValue("12");
  await page.getByRole("button", { name: "Queue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Up next" })).toBeVisible();
  await page.getByRole("button", { name: "Now playing", exact: true }).click();
  await page.screenshot({ path: "test-results/daw-one-1280x400.png" });
});
test("offline settings and fault visibility", async ({ page }) => {
  await page.request.post("/api/scenario", { data: { name: "Cold boot" } });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Hardware Simulator", exact: true })
    .click();
  await page
    .getByRole("button", { name: "thermal-alarm", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveText("thermal-alarm");
  await page.route("**/api/**", (route) => route.abort());
  await expect(page.locator(".status")).toContainText("OFFLINE PREVIEW", {
    timeout: 6000,
  });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Manual video correction").fill("-8");
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Manual video correction")).toHaveValue("-8");
});
test("scenario dashboard drives the shared API and timeline", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Hardware Simulator", exact: true })
    .click();
  for (const [name, mode] of [
    ["Playback", "ready"],
    ["Standby", "standby"],
    ["Wake on presence", "ready"],
    ["Safe shutdown", "shutting-down"],
    ["Network loss", "ready"],
    ["Low voltage", "fault"],
    ["Thermal fault", "fault"],
    ["Controller disconnect", "fault"],
    ["Cold boot", "ready"],
  ]) {
    await page.getByLabel("Automated scenario").selectOption(name);
    await page
      .getByRole("button", { name: "Run scenario", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await (await page.request.get("/api/state")).json()).device.mode,
      )
      .toBe(mode);
    await expect(page.getByLabel("Device timeline")).toContainText(
      `Start ${name}`,
    );
  }
  const invalid = await page.request.post("/api/event", {
    data: { type: "temperature", value: "bad" },
  });
  expect(invalid.status()).toBe(400);
});
test("phone touch layout and keyboard navigation remain usable", async ({
  page,
}) => {
  await page.request.post("/api/scenario", { data: { name: "Cold boot" } });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).tap();
  await expect(page.getByRole("slider", {name:"Display brightness"})).toBeVisible();
  await page
    .getByRole("button", { name: "Hardware Simulator", exact: true })
    .tap();
  await expect(
    page.getByRole("heading", { name: "Hardware Simulator" }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.getByRole("button", { name: "Now playing", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Weightless" })).toBeVisible();
});
test("themes, custom tokens, local persistence, Nerd diagnostics and automatic state", async ({
  page,
}) => {
  await page.request.post("/api/scenario", { data: { name: "Cold boot" } });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  for (const [id, name] of [
    ["reference-dark", "Reference Dark"],
    ["warm-bronze", "Warm Bronze"],
    ["champagne-gold", "Champagne Gold"],
    ["cinematic", "Cinematic"],
    ["nerd-mode", "Nerd Mode"],
  ]) {
    await page.getByLabel("Skin", { exact: true }).selectOption(id);
    await expect(page.locator("main")).toHaveAttribute("data-theme", id);
    await expect(page.getByLabel("Theme engine")).toContainText(
      `Active: ${name}`,
    );
  }
  await page.getByRole("button", { name: "Now playing", exact: true }).click();
  await expect(page.getByLabel("Nerd diagnostics")).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByText("Customize design tokens", { exact: true }).click();
  await page.getByLabel("Glow intensity", { exact: true }).fill("12");
  await page.getByLabel("Custom theme name").fill("My Studio");
  await page
    .getByRole("button", { name: "Save custom theme", exact: true })
    .click();
  await expect(page.getByLabel("Theme engine")).toContainText(
    "Active: My Studio",
  );
  await expect(page.locator("main")).toHaveCSS("--glow", "12px");
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Theme engine")).toContainText(
    "Active: My Studio",
  );
  await page.getByLabel("Automatic switching").selectOption("state");
  await page.request.post("/api/event", { data: { type: "thermal-alarm" } });
  await expect(page.locator("main")).toHaveAttribute("data-theme", "nerd-mode");
  await page.getByLabel("Automatic switching").selectOption("schedule");
  await expect(page.getByLabel("Day skin", { exact: true })).toBeVisible();
});
