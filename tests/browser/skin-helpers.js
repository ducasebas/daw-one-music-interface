export async function chooseSkin(page, id) {
  const current = await page.locator(".music2").getAttribute("data-page");
  await page.getByRole("button", { name: "Instellingen", exact: true }).click();
  await page.getByLabel("Settings page", { exact: true }).selectOption("1");
  await page.getByLabel("Skin", { exact: true }).selectOption(id);
  if (current !== "settings")
    await page
      .getByRole("button", {
        name: {
          discover: "Ontdek",
          library: "Mijn muziek",
          search: "Zoeken",
          queue: "Wachtrij",
          rooms: "Kamers",
          playing: "Open Nu spelen",
        }[current],
        exact: true,
      })
      .click();
}
