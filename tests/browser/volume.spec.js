import { chooseSkin } from "./skin-helpers.js";
import { test, expect } from "@playwright/test";
async function start(page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.request.post("/api/scenario", { data: { name: "Playback" } });
  await page.request.post("/api/event", {
    data: { type: "volume", value: 32 },
  });
  await page.request.post("/api/event", {
    data: { type: "mute", value: false },
  });
  await page.goto("/?gui=2&product=1");
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await expect(
    page.getByRole("slider", { name: "Volume", exact: true }),
  ).toHaveAttribute("aria-disabled", "false");
}
const volume = async (page) =>
  (await (await page.request.get("/api/state")).json()).audio.volume;
async function pointer(page) {
  if (page.context().browser().browserType().name() === "chromium")
    return page.context().newCDPSession(page);
  let id = 1;
  return {
    async send(_method, { type, touchPoints }) {
      if (type === "touchStart") {
        await page.evaluate(() =>
          document.addEventListener(
            "pointerdown",
            (e) => (window.__testPointerId = e.pointerId),
            { once: true, capture: true },
          ),
        );
        await page.mouse.move(touchPoints[0].x, touchPoints[0].y);
        await page.mouse.down();
        id = await page.evaluate(() => window.__testPointerId);
      }
      if (type === "touchMove")
        await page.mouse.move(touchPoints[0].x, touchPoints[0].y);
      if (type === "touchEnd") await page.mouse.up();
      if (type === "touchCancel") {
        await page
          .getByRole("slider", { name: "Volume", exact: true })
          .dispatchEvent("pointercancel", { pointerId: id, isPrimary: true });
        await page.mouse.up();
      }
    },
    async detach() {},
  };
}
async function gesture(page, steps, end = "touchEnd") {
  const c = await pointer(page);
  await c.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: steps[0][0], y: steps[0][1] }],
  });
  for (const [x, y] of steps.slice(1))
    await c.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y }],
    });
  await c.send("Input.dispatchTouchEvent", { type: end, touchPoints: [] });
  await c.detach();
}
test("touch drag changes volume while moving and cancellation stops without a second commit", async ({
  page,
}) => {
  await start(page);
  const s = page.getByRole("slider", { name: "Volume", exact: true }),
    b = await s.boundingBox(),
    y = b.y + b.height / 2;
  const c = await pointer(page);
  await c.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: b.x + 12, y }],
  });
  await c.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: b.x + b.width - 12, y }],
  });
  await expect(s).toHaveAttribute("aria-valuenow", "100");
  await expect.poll(() => volume(page)).toBe(100);
  await c.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect.poll(() => volume(page)).toBe(100);
  await gesture(
    page,
    [
      [b.x + 12, y],
      [b.x + b.width / 2, y],
    ],
    "touchCancel",
  );
  await expect.poll(() => volume(page)).toBe(50);
  await s.focus();
  await page.keyboard.press("Home");
  await expect.poll(() => volume(page)).toBe(0);
  await page.getByRole("button", { name: "Volume up", exact: true }).click();
  await expect.poll(() => volume(page)).toBe(1);
  await c.detach();
});
test("rapid volume changes retain latest intent without overlapping requests", async ({
  page,
}) => {
  await start(page);
  let active = 0,
    max = 0;
  const values = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  await page.route("**/api/event", async (r) => {
    if (r.request().postDataJSON().type !== "volume") return r.continue();
    active++;
    max = Math.max(max, active);
    values.push(r.request().postDataJSON().value);
    if (values.length === 1) await firstGate;
    const response = await r.fetch();
    active--;
    await r.fulfill({ response });
  });
  const plus = page.getByRole("button", { name: "Volume up", exact: true });
  await plus.click();
  await plus.click();
  await plus.click();
  releaseFirst();
  await expect.poll(() => volume(page)).toBe(35);
  expect(max).toBe(1);
  expect(values).toEqual([33, 35]);
});
test("circular mode persists, supports touch rotation and keeps all skins within 1280x400", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByLabel("Volume control", { exact: true })
    .selectOption("circular");
  await page.reload();
  await expect(page.locator(".touch-volume-circular")).toBeVisible();
  const s = page.getByRole("slider", { name: "Volume", exact: true });
  await expect(s).toHaveAttribute("aria-disabled", "false");
  const b = await s.boundingBox();
  await gesture(page, [[b.x + b.width / 2, b.y + b.height / 2]]);
  expect(await volume(page)).toBe(32);
  await gesture(page, [
    [b.x + b.width / 2, b.y + 4],
    [b.x + b.width - 4, b.y + b.height / 2],
  ]);
  await expect.poll(() => volume(page)).toBe(83);
  for (const id of [
    "reference-dark",
    "minimal-dark",
    "warm-bronze",
    "champagne-gold",
    "cinematic",
    "nerd-mode",
  ]) {
    await chooseSkin(page, id);
    expect(
      await page
        .locator(".m2-player")
        .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    ).toBeTruthy();
  }
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Volume control", { exact: true })).toHaveValue(
    "circular",
  );
  await page.screenshot({ path: "test-results/circular-volume.png" });
});

test("rejected volume requests roll back preview and report the actual error", async ({
  page,
}) => {
  await start(page);
  await page.route("**/api/event", (r) =>
    r.fulfill({ status: 409, json: { error: "Player refused volume change" } }),
  );
  await page.getByRole("button", { name: "Volume up", exact: true }).click();
  await expect(page.locator(".m2-player-status")).toContainText(
    "Player refused volume change",
  );
  await expect(
    page.getByRole("slider", { name: "Volume", exact: true }),
  ).toHaveAttribute("aria-valuenow", "32");
  expect(await volume(page)).toBe(32);
});

test("live volume respects player ceiling and disables unknown or read-only control", async ({
  page,
}) => {
  await start(page);
  let data = await (await page.request.get("/api/state")).json();
  data = {
    ...data,
    mode: "music-assistant",
    playback: {
      ...data.playback,
      volume: 80,
      capabilities: ["volume_set"],
      source: "music-assistant",
    },
    musicAssistant: { controlEnabled: true, volumeLimit: 40 },
  };
  await page.route("**/api/events", (r) => r.abort());
  await page.route("**/api/state", (r) => r.fulfill({ json: data }));
  let sent = null;
  await page.route("**/api/event", (r) => {
    sent = r.request().postDataJSON();
    data = { ...data, playback: { ...data.playback, volume: sent.value } };
    return r.fulfill({ json: data });
  });
  await page.reload();
  const slider = page.getByRole("slider", { name: "Volume", exact: true });
  await expect(slider).toHaveAttribute("aria-valuemax", "40");
  await expect(slider).toHaveAttribute("aria-valuetext", /80.*limiet 40/);
  await slider.focus();
  await page.keyboard.press("End");
  await expect.poll(() => sent?.value).toBe(40);
  data = { ...data, playback: { ...data.playback, volume: null } };
  await page.reload();
  await expect(slider).toHaveAttribute("aria-disabled", "true");
  data = {
    ...data,
    playback: { ...data.playback, volume: 20 },
    musicAssistant: { controlEnabled: false, volumeLimit: 40 },
  };
  await page.reload();
  await expect(slider).toHaveAttribute("aria-disabled", "true");
});

test("GUI2 every settings page fits without scrolling with both volume presentations", async ({
  page,
}) => {
  await start(page);
  for (const mode of ["linear", "circular"]) {
    await page
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    await page.getByLabel("Settings page", { exact: true }).selectOption("0");
    await page.getByLabel("Volume control", { exact: true }).selectOption(mode);
    for (let index = 0; index < 11; index++) {
      await page
        .getByLabel("Settings page", { exact: true })
        .selectOption(String(index));
      expect(
        await page
          .locator(".page-body")
          .evaluate((e) => e.scrollHeight <= e.clientHeight + 1),
      ).toBeTruthy();
    }
  }
});

test("large event log keeps the live stream connected during volume use", async ({
  page,
}) => {
  await start(page);
  let errors = 0;
  page.on("requestfailed", (r) => {
    if (r.url().endsWith("/api/events")) errors++;
  });
  for (let i = 0; i < 140; i++)
    await page.request.post("/api/event", {
      data: { type: "volume", value: i % 80 },
    });
  const slider = page.getByRole("slider", { name: "Volume", exact: true });
  await expect(slider).toHaveAttribute("aria-disabled", "false");
  await slider.focus();
  await page.keyboard.press("Home");
  await expect.poll(() => volume(page)).toBe(0);
  await expect(page.locator(".m2-player-status")).not.toContainText(
    "Disconnected",
  );
  expect(errors).toBe(0);
});

test("scaled workbench volume uses the same touch geometry as the product", async ({
  page,
}) => {
  await start(page);
  await page.goto("/?gui=2&lab=1");
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  const slider = page.getByRole("slider", { name: "Volume", exact: true });
  await expect(slider).toHaveAttribute("aria-disabled", "false");
  const b = await slider.boundingBox(),
    logical = await slider.evaluate((e) => e.offsetWidth),
    inset = (12 * b.width) / logical;
  await gesture(page, [
    [b.x + inset, b.y + b.height / 2],
    [b.x + inset + (b.width - 2 * inset) * 0.75, b.y + b.height / 2],
  ]);
  await expect.poll(() => volume(page)).toBe(75);
});

test("mute greys both volume presentations without changing the stored volume or position", async ({
  page,
}) => {
  await start(page);
  for (const mode of ["linear", "circular"]) {
    await page
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    await page.getByLabel("Settings page", { exact: true }).selectOption("0");
    await page.getByLabel("Volume control", { exact: true }).selectOption(mode);
    await page.getByRole("button", { name: "Open Now Playing" }).click();
    const slider = page.getByRole("slider", { name: "Volume", exact: true });
    const before = await slider.getAttribute("style");
    await page.getByRole("button", { name: "Mute", exact: true }).click();
    await expect(page.locator(".m2-player>.touch-volume")).toHaveAttribute(
      "data-muted",
      "true",
    );
    await expect(slider).toHaveAttribute("aria-valuenow", "32");
    await expect(slider).toHaveAttribute("aria-valuetext", /gedempt/);
    expect(await slider.getAttribute("style")).toBe(before);
    expect(await volume(page)).toBe(32);
    await page.screenshot({ path: `test-results/muted-${mode}.png` });
    await page.getByRole("button", { name: "Unmute", exact: true }).click();
    await expect(page.locator(".m2-player>.touch-volume")).toHaveAttribute(
      "data-muted",
      "false",
    );
    expect(await volume(page)).toBe(32);
  }
});
