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
  await page.getByLabel("Simulator page", { exact: true }).selectOption("3");
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
    const state = await (await page.request.get("/api/state")).json();
    expect(state.log.some((e) => e.reason === `Start ${name}`)).toBeTruthy();
  }
  await page.getByLabel("Simulator page", { exact: true }).selectOption("4");
  await expect(page.getByLabel("Device timeline")).toContainText(
    "amplifier-request",
  );
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
  await expect(
    page.getByRole("slider", { name: "Display brightness" }),
  ).toBeVisible();
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
  const settings = async (index) => {
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page
      .getByLabel("Settings page", { exact: true })
      .selectOption(String(index));
  };
  await settings(1);
  for (const id of [
    "reference-dark",
    "warm-bronze",
    "champagne-gold",
    "cinematic",
    "nerd-mode",
  ]) {
    await page.getByLabel("Skin", { exact: true }).selectOption(id);
    await expect(page.locator("main")).toHaveAttribute("data-theme", id);
  }
  await page.getByRole("button", { name: "Now playing", exact: true }).click();
  await expect(page.getByLabel("Nerd diagnostics")).toBeVisible();
  await settings(5);
  await page.getByLabel("Glow intensity", { exact: true }).fill("12");
  await page.getByLabel("Settings page", { exact: true }).selectOption("9");
  await page.getByLabel("Custom theme name").fill("My Studio");
  await page
    .getByRole("button", { name: "Save custom theme", exact: true })
    .click();
  await expect(page.getByLabel("Theme engine")).toContainText(
    "Active: My Studio",
  );
  await expect(page.locator("main")).toHaveCSS("--glow", "12px");
  await page.reload();
  await settings(1);
  await expect(page.getByLabel("Theme engine")).toContainText(
    "Active: My Studio",
  );
  await page.getByLabel("Settings page", { exact: true }).selectOption("6");
  await page.getByLabel("Automatic switching").selectOption("state");
  await page.request.post("/api/event", { data: { type: "thermal-alarm" } });
  await expect(page.locator("main")).toHaveAttribute("data-theme", "nerd-mode");
  await page.getByLabel("Automatic switching").selectOption("schedule");
  await page.getByLabel("Settings page", { exact: true }).selectOption("7");
  await expect(page.getByLabel("Day skin", { exact: true })).toBeVisible();
});

async function swipe(page, selector, direction = "left") {
  const b = await page.locator(selector).boundingBox(),
    client = await page.context().newCDPSession(page);
  const x1 = b.x + b.width * (direction === "left" ? 0.85 : 0.15),
    x2 = b.x + b.width * (direction === "left" ? 0.15 : 0.85),
    y = b.y + b.height - 10;
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: x1, y }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x2, y }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await client.detach();
}
test("settings pages swipe without scrolling and retain accessible navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await swipe(page, ".page-body");
  await expect(page.getByLabel("Settings page", { exact: true })).toHaveValue(
    "1",
  );
  await swipe(page, ".page-body", "right");
  await expect(page.getByLabel("Settings page", { exact: true })).toHaveValue(
    "0",
  );
  for (let i = 0; i < 10; i++) {
    await page
      .getByLabel("Settings page", { exact: true })
      .selectOption(String(i));
    expect(
      await page
        .locator(".page-body")
        .evaluate((e) => e.scrollHeight <= e.clientHeight + 1),
    ).toBeTruthy();
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBe(400);
  }
  await page.getByLabel("Settings page", { exact: true }).selectOption("0");
  await page.getByRole("region", { name: "Settings", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("Settings page", { exact: true })).toHaveValue(
    "1",
  );
});
test("interactive case, illuminated power, speakers and modules share live safety state", async ({
  page,
}) => {
  await page.request.post("/api/scenario", { data: { name: "Playback" } });
  await page.goto("/");
  await page.getByRole("button", { name: "Device", exact: true }).click();
  await page.getByRole("button", { name: "Playback demo", exact: true }).tap();
  await expect(page.getByLabel("Left speaker driven")).toBeVisible();
  await expect(page.locator("[data-module=amplifier]")).toHaveAttribute(
    "data-status",
    "on",
  );
  await page.screenshot({ path: "test-results/daw-one-case.png" });
  await page.locator("[data-module=wifi]").tap();
  await page
    .getByRole("button", { name: "Disconnect Wi-Fi", exact: true })
    .tap();
  await expect(page.locator("[data-module=wifi]")).toHaveAttribute(
    "data-status",
    "off",
  );
  await expect(page.getByLabel("Left speaker silent")).toBeVisible();
  await page.getByRole("button", { name: "Playback demo", exact: true }).tap();
  await page
    .getByRole("button", { name: "Case power button", exact: true })
    .tap();
  await expect(page.getByLabel("Status LED standby")).toBeVisible();
  await expect(page.getByLabel("Left speaker silent")).toBeVisible();
  await page.getByRole("button", { name: "Wake device", exact: true }).tap();
  await expect(page.getByLabel("Status LED ready")).toBeVisible();
  await page.request.post("/api/scenario", { data: { name: "Playback" } });
  await page.request.post("/api/event", { data: { type: "display-timeout" } });
  await expect(page.locator(".case-screen")).toHaveAttribute(
    "data-awake",
    "false",
  );
  await page.getByRole("button", { name: "Device display", exact: true }).tap();
  await expect(page.locator(".case-screen")).toHaveAttribute(
    "data-awake",
    "true",
  );
  await expect(page.getByLabel("Left speaker driven")).toBeVisible();
  await page.request.post("/api/event", { data: { type: "amplifier-fault" } });
  await expect(page.getByLabel("Status LED fault")).toBeVisible();
  await expect(page.getByLabel("Left speaker silent")).toBeVisible();
  await expect(page.locator("[data-module=amplifier]")).toHaveAttribute(
    "data-status",
    "fault",
  );
  await page.route("**/api/**", (r) => r.abort());
  await expect(page.getByLabel("Status LED unknown")).toBeVisible();
  await expect(page.locator("[data-module=amplifier]")).toHaveAttribute(
    "data-status",
    "unknown",
  );
});
test("all simulator pages and phone settings fit without vertical scrolling", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Hardware Simulator", exact: true })
    .click();
  for (let i = 0; i < 5; i++) {
    await page
      .getByLabel("Simulator page", { exact: true })
      .selectOption(String(i));
    expect(
      await page
        .locator(".page-body")
        .evaluate((e) => e.scrollHeight <= e.clientHeight + 1),
    ).toBeTruthy();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  for (let i = 0; i < 10; i++) {
    await page
      .getByLabel("Settings page", { exact: true })
      .selectOption(String(i));
    expect(
      await page
        .locator(".page-body")
        .evaluate((e) => e.scrollHeight <= e.clientHeight + 1),
    ).toBeTruthy();
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBe(844);
  }
  await page.getByRole("button", { name: "Device", exact: true }).click();
  await expect(page.getByLabel("DAW ONE exterior")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    844,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});
test("reference volume supports fine keyboard and touch buttons and connection page", async ({
  page,
}) => {
  await page.goto("/");
  const dial = page.getByRole("slider", { name: "Volume", exact: true });
  await dial.focus();
  await page.keyboard.press("Home");
  await expect(dial).toHaveAttribute("aria-valuenow", "0");
  await page
    .getByRole("button", { name: "Increase volume", exact: true })
    .tap();
  await expect(dial).toHaveAttribute("aria-valuenow", "1");
  await dial.focus();
  await page.keyboard.press("PageUp");
  await expect(dial).toHaveAttribute("aria-valuenow", "6");
  await page.getByRole("button", { name: "Mute", exact: true }).tap();
  await expect(
    page.getByRole("button", { name: "Unmute", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(dial).toHaveAttribute("aria-valuenow", "6");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Settings page", { exact: true }).selectOption("10");
  await expect(page.getByLabel("Music Assistant connection")).toContainText(
    "SIMULATION",
  );
  expect(
    await page
      .locator(".page-body")
      .evaluate((e) => e.scrollHeight <= e.clientHeight + 1),
  ).toBeTruthy();
});
test("live metadata and actual volume render without presenting simulator as connected music", async ({
  page,
}) => {
  const real = {
    device: {
      mode: "ready",
      faults: [],
      amplifierEnabled: false,
      verified: false,
      displayAwake: true,
    },
    playback: {
      connected: true,
      playing: true,
      index: 0,
      queue: [
        {
          id: "real",
          title: "Actual player track",
          artist: "Real artist",
          album: "",
          duration: 200,
        },
      ],
      position: 25,
      observedAt: Date.now(),
      volume: 18,
      muted: false,
      capabilities: ["volume_set", "volume_mute", "seek"],
    },
    mode: "music-assistant",
    musicAssistant: {
      controlEnabled: false,
      connected: true,
      status: "connected",
      serverVersion: "protocol-fixture",
      players: [],
      volumeLimit: 40,
    },
  };
  await page.route("**/api/events", (r) => r.abort());
  await page.route("**/api/state", (r) => r.fulfill({ json: real }));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Actual player track" }),
  ).toBeVisible();
  await expect(page.locator(".status")).toContainText("LIVE MUSIC");
  await expect(
    page.getByRole("slider", { name: "Volume", exact: true }),
  ).toHaveAttribute("aria-valuenow", "18");
  await expect(
    page.getByRole("button", { name: "Increase volume", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Device", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hardware is simulated" }),
  ).toBeVisible();
});
