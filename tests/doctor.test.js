import { test } from "node:test";
import assert from "node:assert/strict";
import { checkApplication } from "../server/doctor.js";
const responses = {
  "/api/health": [
    { ok: true, mode: "simulation", musicAssistant: "mock" },
    "application/json",
  ],
  "/": [
    '<div id="root"></div><script src="/assets/main.js"></script><link href="/assets/main.css">',
    "text/html",
  ],
  "/assets/main.js": ["console.log(1)", "text/javascript"],
  "/assets/main.css": ["body{}", "text/css"],
  "/media/startup.mp4": ["video", "video/mp4"],
  "/media/startup-still.png": ["image", "image/png"],
  "/docs/pi-first-run.md": ["Installation", "text/plain"],
};
function fixture(overrides = {}) {
  return async (url) => {
    const data = { ...responses, ...overrides }[url.pathname];
    if (!data) return new Response("missing", { status: 404 });
    return new Response(
      typeof data[0] === "object" ? JSON.stringify(data[0]) : data[0],
      { headers: { "content-type": data[1] } },
    );
  };
}
test("doctor checks built frontend, media and local guide without claiming real music or hardware", async () => {
  const result = await checkApplication("http://127.0.0.1:3001", fixture());
  assert.equal(
    result.results.every((r) => r.ok),
    true,
  );
  assert.equal(result.health.musicAssistant, "mock");
});
test("doctor rejects missing media, invalid health and HTML disguised as a script", async () => {
  const result = await checkApplication(
    "http://127.0.0.1:3001",
    fixture({
      "/api/health": [{ ok: false }, "application/json"],
      "/assets/main.js": ["<html>Login</html>", "text/html"],
      "/media/startup.mp4": null,
    }),
  );
  assert.equal(result.results.filter((r) => !r.ok).length, 3);
});
test("doctor rejects credential-bearing addresses and does not accept a Vite shell as the installed frontend", async () => {
  await assert.rejects(
    checkApplication("http://user:secret@localhost", fixture()),
  );
  const result = await checkApplication(
    "http://localhost",
    fixture({
      "/": [
        '<div id="root"></div><script src="/@vite/client"></script>',
        "text/html",
      ],
    }),
  );
  assert.equal(
    result.results.find((r) => r.label === "Production frontend").ok,
    false,
  );
});
