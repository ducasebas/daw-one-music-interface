import { test, expect } from "@playwright/test";
const reset = (page) =>
  page.request.post("/api/scenario", { data: { name: "Cold boot" } });
const settings = async (page, index = 0) => {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByLabel("Settings page", { exact: true })
    .selectOption(String(index));
};
async function swipe(page, direction = "left") {
  const b = await page.locator(".page-body").boundingBox(),
    x = b.x + b.width * (direction === "left" ? 0.85 : 0.15),
    end = b.x + b.width * (direction === "left" ? 0.15 : 0.85),
    y = b.y + b.height - 10;
  if (page.context().browser().browserType().name() !== "chromium") {
    // WebKit has no CDP touch injection; exercise the same React touch handlers.
    await page.locator(".page-body").evaluate(
      (el, { x, end, y }) => {
        for (const [type, touches, changedTouches] of [
          ["touchstart", [{ clientX: x, clientY: y }], []],
          ["touchend", [], [{ clientX: end, clientY: y }]],
        ]) {
          const event = new Event(type, { bubbles: true });
          Object.assign(event, { touches, changedTouches });
          el.dispatchEvent(event);
        }
      },
      { x, end, y },
    );
    return;
  }
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: end, y }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await client.detach();
}
test("reference product fits 1280x400 with working playback and persistent settings", async ({
  page,
}) => {
  await reset(page);
  await page.goto("/?product=1");
  await page.getByRole("button", { name: "Play", exact: true }).tap();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next track" }).tap();
  await expect(page.getByRole("heading", { name: "A Walk" })).toBeVisible();
  await page.getByRole("button", { name: "Video artwork", exact: false }).tap();
  await expect(page.getByText("VIDEO ARTWORK · MOCK")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    400,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    1280,
  );
  await settings(page);
  await page.getByLabel("Manual video correction").fill("12");
  await page.reload();
  await settings(page);
  await expect(page.getByLabel("Manual video correction")).toHaveValue("12");
  await page.getByRole("button", { name: "Now playing", exact: true }).click();
  await page.screenshot({ path: "test-results/reference-product.png" });
});
test("offline settings remain available and show backend loss", async ({
  page,
}) => {
  await reset(page);
  await page.goto("/?product=1");
  await page.request.post("/api/event", { data: { type: "thermal-alarm" } });
  await page.route("**/api/**", (r) => r.abort());
  await expect(page.locator(".status")).toContainText("OFFLINE PREVIEW");
  await settings(page);
  await page.getByLabel("Manual video correction").fill("-8");
  await page.reload();
  await settings(page);
  await expect(page.getByLabel("Manual video correction")).toHaveValue("-8");
});
test("workbench controls and embedded product use one runtime", async ({
  page,
}) => {
  await reset(page);
  await page.goto("/?lab=1");
  await page.getByLabel("Automated scenario").selectOption("Playback");
  await page.getByRole("button", { name: "Run scenario", exact: true }).tap();
  await expect(page.getByLabel("Left speaker driven")).toBeVisible();
  const screen = page.getByRole("region", {
    name: "DAW ONE product display",
    exact: true,
  });
  await expect(
    screen.getByRole("heading", { name: "Weightless" }),
  ).toBeVisible();
  await screen.getByRole("button", { name: "Next track" }).click();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/state")).json()).playback.index,
    )
    .toBe(1);
  await expect(screen.getByRole("heading", { name: "A Walk" })).toBeVisible();
  await expect(
    screen.getByRole("button", { name: "Test bench", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Events", exact: true }).click();
  await expect(page.getByLabel("Device timeline")).toContainText("next");
});
test("power button and LED ring sit on top, modules and events stay outside case", async ({
  page,
}) => {
  await page.request.post("/api/scenario", { data: { name: "Playback" } });
  await page.goto("/?lab=1");
  await expect(page.getByLabel("Left speaker driven")).toBeVisible();
  expect(await page.locator(".physical-device [data-module]").count()).toBe(0);
  // ResizeObserver can update the case between separate protocol reads.
  // Compare both rectangles in the same layout frame after it settles.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const power = document
          .querySelector(".top-power")
          .getBoundingClientRect();
        const front = document
          .querySelector(".physical-front")
          .getBoundingClientRect();
        return power.bottom <= front.top + 1;
      }),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Case power button", exact: true })
    .tap();
  await expect(page.getByLabel("Status LED standby")).toBeVisible();
  await expect(page.getByLabel("Left speaker silent")).toBeVisible();
  await page.getByRole("button", { name: "Wake device", exact: true }).tap();
  await expect(page.getByLabel("Status LED ready")).toBeVisible();
  await page.getByRole("tab", { name: "Modules", exact: true }).click();
  await page.locator("[data-module=amplifier]").tap();
  await page
    .getByRole("button", { name: "Inject amp fault", exact: true })
    .tap();
  await expect(page.getByLabel("Status LED fault")).toBeVisible();
  await expect(page.locator("[data-module=amplifier]")).toHaveAttribute(
    "data-status",
    "fault",
  );
  await expect(page.getByLabel("Latest state changes")).toContainText(
    "amplifier-fault",
  );
  await expect(page.getByLabel("Latest state changes")).toBeInViewport({
    ratio: 1,
  });
  await page.screenshot({ path: "test-results/separate-workbench.png" });
});
test("display sleep keeps safe audio; screen touch wakes; offline indicators become unknown", async ({
  page,
}) => {
  await page.request.post("/api/scenario", { data: { name: "Playback" } });
  await page.goto("/?lab=1");
  await page.request.post("/api/event", { data: { type: "display-timeout" } });
  await expect(
    page.getByRole("button", { name: "Wake device display" }),
  ).toBeVisible();
  await expect(page.getByLabel("Left speaker driven")).toBeVisible();
  await page.getByRole("button", { name: "Wake device display" }).tap();
  await expect(
    page.getByRole("button", { name: "Wake device display" }),
  ).toHaveCount(0);
  await page.request.post("/api/event", { data: { type: "amplifier-fault" } });
  await page.route("**/api/**", (r) => r.abort());
  await expect(page.getByLabel("Status LED unknown")).toBeVisible();
  await expect(page.getByLabel("Left speaker silent")).toBeVisible();
});
test("six reference layouts, theme customization and state automation persist", async ({
  page,
}) => {
  await reset(page);
  await page.goto("/?product=1");
  for (const id of [
    "reference-dark",
    "minimal-dark",
    "warm-bronze",
    "champagne-gold",
    "cinematic",
    "nerd-mode",
  ]) {
    await settings(page, 1);
    await page.getByLabel("Skin", { exact: true }).selectOption(id);
    await page
      .getByRole("button", { name: "Now playing", exact: true })
      .click();
    await expect(page.locator("main")).toHaveAttribute("data-layout", id);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBe(400);
    if (id === "cinematic") {
      const art = await page.locator(".art").boundingBox(),
        track = await page.locator(".track").boundingBox();
      expect(art.x).toBeGreaterThan(track.x);
      await expect(page.getByLabel("Upcoming tracks")).toBeVisible();
    }
    if (id === "nerd-mode")
      await expect(page.getByLabel("Nerd diagnostics")).toContainText(
        "Not measured",
      );
  }
  await settings(page, 5);
  await page.getByLabel("Glow intensity").fill("12");
  await page.getByLabel("Settings page", { exact: true }).selectOption("9");
  await page.getByLabel("Custom theme name").fill("My Studio");
  await page
    .getByRole("button", { name: "Save custom theme", exact: true })
    .click();
  await page.reload();
  await settings(page, 1);
  await expect(page.getByLabel("Theme engine")).toContainText("My Studio");
  await page.getByLabel("Settings page", { exact: true }).selectOption("6");
  await page.getByLabel("Automatic switching").selectOption("state");
  await page.request.post("/api/event", { data: { type: "thermal-alarm" } });
  await expect(page.locator("main")).toHaveAttribute("data-theme", "nerd-mode");
});
test("all settings pages swipe without scroll and support arrows", async ({
  page,
}) => {
  await reset(page);
  await page.goto("/?product=1");
  await settings(page);
  await swipe(page);
  await expect(page.getByLabel("Settings page", { exact: true })).toHaveValue(
    "1",
  );
  await swipe(page, "right");
  await expect(page.getByLabel("Settings page", { exact: true })).toHaveValue(
    "0",
  );
  for (let i = 0; i < 11; i++) {
    await page
      .getByLabel("Settings page", { exact: true })
      .selectOption(String(i));
    expect(
      await page
        .locator(".page-body")
        .evaluate((e) => e.scrollHeight <= e.clientHeight + 1),
    ).toBeTruthy();
  }
  await page.getByRole("region", { name: "Settings", exact: true }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByLabel("Settings page", { exact: true })).toHaveValue(
    "9",
  );
});
test("states events and simulation pages are visible without desktop overflow", async ({
  page,
}) => {
  await reset(page);
  await page.goto("/?lab=1");
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
  for (const tab of ["Modules", "States", "Events"]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    expect(
      await page
        .locator(".bench-tab-content")
        .evaluate((e) => e.scrollHeight <= e.clientHeight + 1),
    ).toBeTruthy();
  }
  await page.getByRole("tab", { name: "States", exact: true }).click();
  await expect(page.getByLabel("Device states")).toContainText(
    "Amplifier enable request",
  );
});
test("phone product settings and separate workbench remain usable", async ({
  page,
}) => {
  await reset(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?product=1");
  await settings(page);
  for (let i = 0; i < 11; i++) {
    await page
      .getByLabel("Settings page", { exact: true })
      .selectOption(String(i));
    expect(
      await page
        .locator(".page-body")
        .evaluate((e) => e.scrollHeight <= e.clientHeight + 1),
    ).toBeTruthy();
  }
  await page.getByRole("button", { name: "Test bench", exact: true }).tap();
  await expect(page.getByLabel("Physical device preview")).toBeVisible();
  await page.getByRole("tab", { name: "Modules", exact: true }).tap();
  await expect(page.getByLabel("Simulated modules")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    844,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({ path: "test-results/workbench-phone.png" });
});
test("reference volume supports keyboard mute and connection settings", async ({
  page,
}) => {
  await page.goto("/?product=1");
  const v = page.getByRole("slider", { name: "Volume", exact: true });
  await v.focus();
  await page.keyboard.press("Home");
  await expect(v).toHaveAttribute("aria-valuenow", "0");
  await page
    .getByRole("button", { name: "Increase volume", exact: true })
    .tap();
  await expect(v).toHaveAttribute("aria-valuenow", "1");
  await page.getByRole("button", { name: "Mute", exact: true }).tap();
  await expect(
    page.getByRole("button", { name: "Unmute", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await settings(page, 10);
  await expect(page.getByLabel("Music Assistant connection")).toContainText(
    "SIMULATION",
  );
});
test("live source displays actual metadata and read-only controls", async ({
  page,
}) => {
  const data = {
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
      serverVersion: "fixture",
      players: [],
      volumeLimit: 40,
    },
  };
  await page.route("**/api/events", (r) => r.abort());
  await page.route("**/api/state", (r) => r.fulfill({ json: data }));
  await page.goto("/?product=1");
  await expect(
    page.getByRole("heading", { name: "Actual player track" }),
  ).toBeVisible();
  await expect(
    page.getByRole("slider", { name: "Volume", exact: true }),
  ).toHaveAttribute("aria-valuenow", "18");
  await expect(
    page.getByRole("button", { name: "Increase volume", exact: true }),
  ).toBeDisabled();
});
test("startup media falls back to supplied still and never stalls a ready device", async ({
  page,
}) => {
  await reset(page);
  await page.route("**/media/startup.mp4", (r) => r.abort());
  await page.route("**/media/startup.webm", (r) => r.abort());
  await page.goto("/?product=1");
  await expect(page.getByLabel("Startup animation")).toBeVisible();
  await expect(page.getByLabel("Startup animation")).toHaveAttribute(
    "data-renderer",
    "fallback",
  );
  await expect(page.getByAltText("ONE · DUTCHAUDIOWORKS")).toBeVisible();
  await expect(page.getByLabel("Startup animation")).toHaveCount(0, {
    timeout: 6000,
  });
  await page.getByRole("button", { name: "Play", exact: true }).tap();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
});
test("workbench replays branding without resetting device state", async ({
  page,
}) => {
  await reset(page);
  await page.goto("/?lab=1");
  const screen = page.getByRole("region", {
    name: "DAW ONE product display",
    exact: true,
  });
  await expect(screen.getByLabel("Startup animation")).toHaveCount(0, {
    timeout: 6000,
  });
  await page
    .getByRole("button", { name: "Replay startup", exact: true })
    .click();
  await expect(screen.getByLabel("Startup animation")).toBeVisible();
  const state = await (await page.request.get("/api/state")).json();
  expect(state.device.mode).toBe("ready");
  expect(state.device.amplifierEnabled).toBe(false);
  await expect(screen.getByLabel("Startup animation")).toHaveCount(0, {
    timeout: 6000,
  });
});
test("branding holds at boot and gives fault state priority", async ({
  page,
}) => {
  await reset(page);
  await page.goto("/?product=1");
  await expect(page.getByLabel("Startup animation")).toHaveCount(0, {
    timeout: 6000,
  });
  await page.request.post("/api/event", { data: { type: "boot" } });
  await expect(page.getByLabel("Startup animation")).toBeVisible();
  await expect(page.getByText("Starting device…", { exact: true })).toBeVisible(
    { timeout: 6000 },
  );
  await page.request.post("/api/event", { data: { type: "thermal-alarm" } });
  await expect(page.getByLabel("Startup animation")).toHaveCount(0);
  await expect(page.locator(".status")).toContainText("FAULT");
});

test("virtual display works when nested browser frames are blocked", async ({
  page,
}) => {
  await reset(page);
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        "x-frame-options": "DENY",
        "content-security-policy": "frame-src 'none'",
      },
    });
  });
  await page.goto("/?lab=1");
  const display = page.getByRole("region", {
    name: "DAW ONE product display",
    exact: true,
  });
  await expect(
    display.getByRole("heading", { name: "Weightless" }),
  ).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      display
        .locator("main")
        .evaluate((el) => [el.offsetWidth, el.offsetHeight]),
    )
    .toEqual([1280, 400]);
  await display.getByRole("button", { name: "Next track" }).click();
  await expect(display.getByRole("heading", { name: "A Walk" })).toBeVisible();
});

test("module loading failures show a readable startup message", async ({
  page,
}) => {
  await page.route("**/src/main.jsx", (route) => route.abort());
  await page.goto("/?product=1");
  await expect(page.locator("#boot-status")).toContainText("kon niet laden");
  await expect(page.locator("#boot-status")).toContainText("display-r3");
});
test("render failures show a recovery action instead of an empty page", async ({
  page,
}) => {
  await page.route("**/api/events", (route) => route.abort());
  await page.route("**/api/state", (route) => route.fulfill({ json: null }));
  await page.goto("/?lab=1");
  await expect(page.getByRole("alert")).toContainText(
    "kon het scherm niet tekenen",
  );
  await expect(
    page.getByRole("button", { name: "Opnieuw laden" }),
  ).toBeVisible();
});

test("default browser keeps test bench visible during navigation and fault acknowledgement", async ({
  page,
}) => {
  await reset(page);
  await page.goto("/");
  const display = page.getByRole("region", {
    name: "DAW ONE product display",
    exact: true,
  });
  await expect(page.getByLabel("Separate hardware test panel")).toBeVisible();
  await display.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Separate hardware test panel")).toBeVisible();
  await display.getByRole("button", { name: "Queue", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Product only" }),
  ).toHaveAttribute("target", "_blank");
  await page.request.post("/api/event", { data: { type: "amplifier-fault" } });
  await expect(page.getByLabel("Safety explanation")).toContainText(
    "amplifier-fault",
  );
  await page.reload();
  await expect(page.getByLabel("Safety explanation")).toContainText(
    "amplifier-fault",
  );
  await page.getByRole("button", { name: "Acknowledge faults" }).click();
  await expect(page.getByLabel("Safety explanation")).toContainText(
    "Safe standby",
  );
  const state = await (await page.request.get("/api/state")).json();
  expect(state.device.faults).toEqual([]);
  expect(state.device.amplifierEnabled).toBe(false);
  expect(state.device.verified).toBe(false);
  await expect(page.getByLabel("Left speaker silent")).toBeVisible();
});

test("startup really plays decoded animation frames in Chromium", async ({
  page,
}) => {
  await reset(page);
  await page.goto("/?screen=1");
  const startup = page.getByLabel("Startup animation");
  await expect(startup).toHaveAttribute("data-renderer", "video");
  await expect
    .poll(() =>
      page.locator(".startup-screen video").evaluate((v) => v.currentTime),
    )
    .toBeGreaterThan(0.1);
  await expect
    .poll(() =>
      page.locator(".startup-screen video").evaluate((v) => v.videoWidth),
    )
    .toBe(1280);
});
test("missing video uses animated logo fallback and reduced-motion stays static", async ({
  page,
}) => {
  await reset(page);
  await page.route("**/media/startup.webm", (route) => route.abort());
  await page.route("**/media/startup.mp4", (route) => route.abort());
  await page.goto("/?screen=1");
  await expect(page.getByLabel("Startup animation")).toHaveAttribute(
    "data-renderer",
    "fallback",
  );
  await expect(page.locator(".startup-logo-motion")).toHaveCSS(
    "animation-name",
    "startup-brand-reveal",
  );
  await expect(page.getByLabel("Startup animation")).toHaveCount(0, {
    timeout: 6500,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.getByLabel("Startup animation")).toHaveAttribute(
    "data-renderer",
    "still",
  );
  await expect(page.locator(".startup-screen video")).toHaveCount(0);
});

test("startup primes a visible first frame and never cuts video short by wall clock", async ({
  page,
}) => {
  await reset(page);
  await page.addInitScript(() => {
    window.startupStarts = [];
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.getAttribute("aria-label") === "DAW ONE cold start video")
        window.startupStarts.push({
          time: this.currentTime,
          autoplay: this.autoplay,
          renderer: this.closest("section")?.dataset.renderer,
        });
      return original.apply(this, arguments);
    };
  });
  await page.goto("/?screen=1");
  await expect
    .poll(() => page.evaluate(() => window.startupStarts.length))
    .toBeGreaterThan(0);
  const first = await page.evaluate(() => window.startupStarts[0]);
  expect(first.time).toBe(0);
  expect(first.autoplay).toBe(false);
  expect(first.renderer).toBe("primed");
  await expect(page.getByLabel("Startup animation")).toHaveAttribute(
    "data-renderer",
    "video",
  );
  await page.locator(".startup-screen video").evaluate((v) => v.pause());
  await page.waitForTimeout(3000);
  await expect(page.getByLabel("Startup animation")).toBeVisible();
  await page.locator(".startup-screen video").evaluate((v) => v.play());
  await expect(page.getByLabel("Startup animation")).toHaveCount(0, {
    timeout: 5000,
  });
});
