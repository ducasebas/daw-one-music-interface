export async function chooseSkin(page, id) {
  await page.locator(".startup-screen").waitFor({state:"hidden"});
  const current = await page.locator(".music2").getAttribute("data-page");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Settings page", { exact: true }).selectOption("1");
  await page.getByLabel("Skin", { exact: true }).selectOption(id);
  if (current !== "settings")
    await page
      .getByRole("button", {
        name: {
          discover: "Discover",
          library: "My music",
          search: "Search",
          queue: "Queue",
          rooms: "Rooms",
          playing: "Open Now Playing",
        }[current],
        exact: true,
      })
      .click();
}
