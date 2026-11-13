import { test, expect } from "@playwright/test";
import { chooseSkin } from "./skin-helpers.js";
const image = "a".repeat(64);
const album = {
  id: "album1",
  type: "album",
  name: "Real Album",
  artist: "Actual Artist",
  available: true,
  favorite: false,
  artwork: `/api/artwork/${image}`,
};
async function live(page, readOnly = false) {
  const state = await (await page.request.get("/api/state")).json();
  state.mode = "music-assistant";
  state.musicAssistant = {
    connected: true,
    playerId: "pi",
    controlEnabled: !readOnly,
  };
  state.playback = {
    ...state.playback,
    connected: true,
    capabilities: ["volume_set", "volume_mute", "seek"],
    volume: 20,
    queue: [
      {
        id: "track",
        title: "Real track",
        artist: "Actual Artist",
        album: "Real Album",
        duration: 200,
        artwork: album.artwork,
      },
    ],
    index: 0,
  };
  await page.route("**/api/events", (r) =>
    r.fulfill({
      contentType: "text/event-stream",
      body: `data: ${JSON.stringify(state)}\n\n`,
    }),
  );
  await page.route("**/api/state", (r) => r.fulfill({ json: state }));
  await page.route("**/api/artwork/*", (r) => r.fulfill({ status: 404 }));
  return state;
}
test("live library browses albums/tracks, plays selected media, restores context and fits all skins", async ({
  page,
}) => {
  const state = await live(page);
  const requests = [];
  await page.route("**/api/library?*", (r) => {
    const q = new URL(r.request().url()).searchParams;
    requests.push(Object.fromEntries(q));
    return r.fulfill({
      json: {
        items: q.has("parent")
          ? [{ ...album, id: "track1", type: "track", name: "Real track" }]
          : [album],
        hasMore: false,
        offset: 0,
        limit: 3,
      },
    });
  });
  const actions = [];
  await page.route("**/api/library/play", (r) => {
    actions.push(r.request().postDataJSON());
    return r.fulfill({ json: state });
  });
  await page.goto("/?gui=2&product=1");
  await expect(
    page.getByRole("button", { name: "Open Real Album", exact: true }),
  ).toBeVisible();
  for (const skin of [
    "reference-dark",
    "minimal-dark",
    "warm-bronze",
    "champagne-gold",
    "cinematic",
    "nerd-mode",
  ]) {
    await chooseSkin(page, skin);
    await expect(
      page.getByRole("button", { name: "Open Real Album", exact: true }),
    ).toBeVisible();
    expect(
      await page
        .locator(".m2-content")
        .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: "Open Real Album", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Play track Real track", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Play track Real track", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Now Playing", exact: true }),
  ).toBeVisible();
  expect(actions).toEqual([{ id: "track1", option: "replace" }]);
  await page
    .getByRole("button", { name: "Discover", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Play Real track", exact: true }),
  ).toBeVisible();
  expect(requests.some((q) => q.parent === "album1")).toBe(true);
});
test("live search ignores late responses and offers touch entry with read-only controls", async ({
  page,
}) => {
  await live(page, true);
  await page.route("**/api/library?*", async (r) => {
    const q = new URL(r.request().url()).searchParams.get("q") || "";
    if (q === "old") await new Promise((resolve) => setTimeout(resolve, 700));
    await r
      .fulfill({
        json: {
          items: [{ ...album, name: q || "Start Album" }],
          hasMore: false,
        },
      })
      .catch(() => {});
  });
  await page.goto("/?gui=2&product=1");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("textbox", { name: "Zoek echte muziek" }).fill("old");
  await page.waitForTimeout(350);
  await page.getByRole("textbox", { name: "Zoek echte muziek" }).fill("new");
  await expect(
    page.getByRole("button", { name: "Open new", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(800);
  await expect(
    page.getByRole("button", { name: "Open old", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Play new", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Zoektoets a", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Zoek echte muziek" }),
  ).toHaveValue("newa");
});
