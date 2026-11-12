import { chooseSkin } from "./skin-helpers.js";
import { test, expect } from "@playwright/test";
test("GUI2 music journey works at 1280x400 through the shared runtime", async ({
  page,
}) => {
  await page.request.post("/api/scenario", { data: { name: "Playback" } });
  await page.goto("/?gui=2&product=1");
  await page.getByRole("button", { name: "My music", exact: true }).click();
  await page.getByRole("button", { name: "Dive Tycho" }).click();
  await page.getByRole("button", { name: "Play next", exact: true }).click();
  await page.getByRole("button", { name: "Queue", exact: true }).click();
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
  await page.getByRole("button", { name: "Search", exact: true }).click();
  for (const k of "tycho")
    await page.getByRole("button", { name: `Toets ${k}`, exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Search music" })).toHaveValue(
    "tycho",
  );
  await expect(
    page.getByRole("button", { name: "A Walk Tycho ›" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Spaces", exact: true }).click();
  await page.getByRole("button", { name: "Try example group" }).click();
  await expect(page.getByText("Example group with TuneBox")).toBeVisible();
  await expect(
    page.getByText("Rivo grouping is a visual example.", { exact: false }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    400,
  );
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await page.screenshot({ path: "test-results/gui2-discover.png" });
});
test("GUI2 all sections fit the native screen, use shared settings and show faults", async ({
  page,
}) => {
  await page.request.post("/api/scenario", { data: { name: "Playback" } });
  await page.goto("/?gui=2&screen=1&display=dsi-production");
  for (const name of [
    "Discover",
    "My music",
    "Search",
    "Queue",
    "Spaces",
    "Settings",
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
  await expect(page.locator(".m2-player-status")).toContainText("Device fault");
  const state = await (await page.request.get("/api/state")).json();
  expect(state.device.amplifierEnabled).toBe(false);
  await page.getByRole("button", { name: "Open Now Playing" }).click();
  await page
    .getByRole("button", { name: "Video Artwork", exact: true })
    .click();
  await expect(page.getByText(/Video synced to Music Assistant|No video linked to this track/)).toBeVisible();
});

test("GUI2 album playback returns to the same search context", async ({
  page,
}) => {
  await page.request.post("/api/scenario", { data: { name: "Playback" } });
  await page.goto("/?gui=2&product=1");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByLabel("Search music").fill("tycho");
  await page.getByRole("button", { name: "A Walk Tycho ›" }).click();
  await page.getByRole("button", { name: "Play now", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A Walk", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to music" }).click();
  await expect(
    page.getByRole("heading", { name: "Dive", exact: true, level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to overview" }).click();
  await expect(page.getByLabel("Search music")).toHaveValue("tycho");
  await expect(page.locator(".music2")).toHaveAttribute("data-motion", "back");
});

test("GUI2 reduced motion and delayed command feedback keep navigation available", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.request.post("/api/scenario", { data: { name: "Playback" } });
  await page.goto("/?gui=2&product=1");
  const activity = page.waitForResponse(
    (r) => r.url().endsWith("/api/activity") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  expect((await activity).status()).toBe(200);
  expect(
    await page
      .locator(".m2-content")
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
  await page.route("**/api/event", async (route) => {
    await new Promise((r) => setTimeout(r, 600));
    await route.continue();
  });
  await page.getByRole("button", { name: "Next track" }).click();
  await expect(page.locator(".m2-player-status")).toHaveAttribute(
    "data-feedback",
    "pending",
  );
  await expect(
    page.getByRole("button", { name: "Next track" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "My music", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My music", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".m2-player-status")).toHaveAttribute(
    "data-feedback",
    "idle",
  );
  await page.goto("/demo.html");
  await expect(page).toHaveURL(/gui=2&lab=1/);
  await expect(
    page.getByRole("navigation", { name: "Music navigation" }),
  ).toBeVisible();
});

test("GUI2 six skins keep shared navigation and native bounds with honest diagnostics", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.request.post("/api/scenario", { data: { name: "Playback" } });
  await page.goto("/?gui=2&screen=1&display=dsi-production");
  const ids = [
    "reference-dark",
    "minimal-dark",
    "warm-bronze",
    "champagne-gold",
    "cinematic",
    "nerd-mode",
  ];
  for (const id of ids) {
    await chooseSkin(page, id);
    await expect(page.locator(".music2")).toHaveAttribute("data-skin", id);
    for (const name of [
      "Discover",
      "My music",
      "Search",
      "Queue",
      "Spaces",
    ]) {
      await page.getByRole("button", { name, exact: true }).click();
      expect(
        await page
          .locator(".m2-content")
          .evaluate((e) => e.scrollHeight <= e.clientHeight + 1),
      ).toBeTruthy();
    }
    await page.getByRole("button", { name: "Open Now Playing" }).click();
    const box = await page.locator(".music2").boundingBox();
    expect(box.width).toBe(1280);
    expect(box.height).toBe(400);
    if (id === "nerd-mode")
      await expect(page.getByLabel("Device diagnostics")).toContainText(
        "UNVERIFIED",
      );
    if (["reference-dark", "warm-bronze"].includes(id))
      await expect(
        page.getByLabel("Stereo levels unavailable"),
      ).toContainText("UNAVAILABLE");
    const icons = await page
      .locator("svg.tb-icon")
      .evaluateAll((els) =>
        els.every(
          (e) =>
            e.getAttribute("fill") === "none" &&
            e.getAttribute("stroke") === "currentColor" &&
            e.getAttribute("viewBox") === "0 0 24 24",
        ),
      );
    expect(icons).toBe(true);
    await page.screenshot({ path: `test-results/gui2-${id}.png` });
  }
  await page.reload();
  await expect(page.locator(".music2")).toHaveAttribute(
    "data-skin",
    "nerd-mode",
  );
});

test("visible frontend release identifies missing and mismatched backend versions", async ({
  page,
}) => {
  await page.goto("/?gui=2&product=1");
  await expect(
    page.getByLabel("Software version", { exact: true }),
  ).toContainText("GUI 3.2.1 · SPLASH");
  await expect(
    page.getByLabel("Software version", { exact: true }),
  ).toHaveAttribute("data-alignment", "matched");
  await page.goto("/?gui=2&lab=1");
  const popup = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Product only", exact: false }).click();
  const product = await popup;
  await expect(product).toHaveURL(/gui=2/);
  await expect(
    product.getByLabel("Software version", { exact: true }),
  ).toContainText("GUI 3.2.1 · SPLASH");
  await product.close();
  await page.goto("/?gui=2&product=1");
  const snapshot = await (await page.request.get("/api/state")).json();
  await page.route("**/api/events", (r) => r.abort());
  await page.route("**/api/state", (r) =>
    r.fulfill({ json: { ...snapshot, build: { id: "older-release" } } }),
  );
  await page.reload();
  await expect(
    page.getByLabel("Software version", { exact: true }),
  ).toContainText("BACKEND VERSION MISMATCH");
});

test("primary play pause glyphs remain centred and symmetric across skins", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.request.post("/api/scenario", { data: { name: "Playback" } });
  await page.goto("/?gui=2&product=1");
  for (const id of [
    "reference-dark",
    "minimal-dark",
    "warm-bronze",
    "champagne-gold",
    "cinematic",
    "nerd-mode",
  ]) {
    await chooseSkin(page, id);
    const pause = page.getByRole("button", { name: "Pause", exact: true });
    const button = await pause.boundingBox(),
      icon = await pause.locator("svg").boundingBox();
    expect(
      Math.abs(button.x + button.width / 2 - (icon.x + icon.width / 2)),
    ).toBeLessThan(0.5);
    expect(
      Math.abs(button.y + button.height / 2 - (icon.y + icon.height / 2)),
    ).toBeLessThan(0.5);
    const bars = await pause.locator("path").evaluate((e) => {
      const b = e.getBBox();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    });
    expect(bars.x).toBe(12);
    expect(bars.y).toBe(12);
    await pause.click();
    const play = page.getByRole("button", { name: "Play", exact: true });
    await expect(play.locator("svg")).toHaveAttribute("data-icon", "play");
    expect(
      await play.locator("path").evaluate((e) => {
        const b = e.getBBox();
        return b.y + b.height / 2;
      }),
    ).toBe(12);
    await play.click();
  }
  await page.screenshot({ path: "test-results/gui2-transport.png" });
});

test("music menu edge flows preserve favourites and show empty search and radio states", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.request.post("/api/scenario", { data: { name: "Playback" } });
  await page.goto("/?gui=2&product=1");
  await page.getByRole("button", { name: "My music", exact: true }).click();
  await page.getByRole("button", { name: "Favourites", exact: true }).click();
  await expect(page.getByText("Your music, close by.")).toBeVisible();
  await page.getByRole("button", { name: "Albums", exact: true }).click();
  await page.getByRole("button", { name: "Dive Tycho" }).click();
  await page
    .getByRole("button", { name: "Save favourite", exact: true })
    .click();
  await page.getByRole("button", { name: "Back to overview" }).click();
  await page.getByRole("button", { name: "Favourites", exact: true }).click();
  await expect(page.getByRole("button", { name: "Dive Tycho" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "My music", exact: true }).click();
  await page.getByRole("button", { name: "Favourites", exact: true }).click();
  await expect(page.getByRole("button", { name: "Dive Tycho" })).toBeVisible();
  await page.getByRole("button", { name: "Radio", exact: true }).click();
  await expect(
    page.getByText("No radio stream connected", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByLabel("Search music").fill("no such track xyz");
  await expect(
    page.getByText("No results for", { exact: false }),
  ).toBeVisible();
});

test("transport visual hierarchy gives primary glyph more weight and mirrors skip buttons", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.request.post("/api/scenario", { data: { name: "Playback" } });
  await page.goto("/?gui=2&product=1");
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  const group = page.locator(".m2-transport");
  const sizes = await group.locator("button").evaluateAll((buttons) =>
    buttons.map((b) => {
      const r = b.getBoundingClientRect(),
        s = b.querySelector("svg"),
        p = s.querySelector("path").getBBox();
      return {
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
        w: r.width,
        h: r.height,
        glyph: (p.height * s.getBoundingClientRect().height) / 24,
      };
    }),
  );
  expect(sizes.map((s) => s.h)).toEqual([44, 44, 44]);
  expect(sizes[0].y).toBe(sizes[1].y);
  expect(sizes[1].y).toBe(sizes[2].y);
  expect(
    Math.abs(sizes[1].x - sizes[0].x - (sizes[2].x - sizes[1].x)),
  ).toBeLessThan(0.1);
  expect(sizes[1].glyph).toBe(16);
  expect(sizes[1].glyph).toBeGreaterThan(sizes[0].glyph);
  await group.screenshot({
    path: "test-results/transport-pause-close.png",
    scale: "css",
  });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await group.screenshot({
    path: "test-results/transport-play-close.png",
    scale: "css",
  });
});

test("music header has network status instead of skin configuration and never invents signal strength", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.request.post("/api/scenario", { data: { name: "Playback" } });
  await page.goto("/?gui=2&product=1");
  await expect(page.locator(".m2-header select")).toHaveCount(0);
  await page.getByLabel("Network status", { exact: true }).click();
  await expect(
    page.getByText("Wi-Fi signal strength unavailable.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".m2-network")).toHaveAttribute(
    "data-signal",
    "unavailable",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".m2-network")).not.toHaveAttribute("open");
  await page.request.post("/api/event", {
    data: { type: "wifi", value: false },
  });
  await expect(page.locator(".m2-network")).toHaveAttribute(
    "data-state",
    "unavailable",
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Settings page", { exact: true }).selectOption("1");
  await expect(page.getByLabel("Skin", { exact: true })).toBeVisible();
});
