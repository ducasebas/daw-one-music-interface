import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
/** Read-only application readiness; explicitly not physical hardware validation. */
export async function checkApplication(
  base = "http://127.0.0.1:3001",
  fetchImpl = fetch,
) {
  const origin = new URL(base);
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash
  )
    throw new Error(
      "Use an HTTP(S) app address without credentials or query parameters",
    );
  const results = [];
  const check = async (path, label, validate = () => true) => {
    try {
      const response = await fetchImpl(new URL(path, origin), {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw Error("HTTP " + response.status);
      const value = await validate(response);
      if (value === false) throw Error("Unexpected response");
      if (!response.bodyUsed) await response.body?.cancel();
      results.push({ label, ok: true });
      return value;
    } catch {
      results.push({ label, ok: false });
      return null;
    }
  };
  const health = await check("/api/health", "Backend HTTP", (r) => r.json());
  if (health && health.ok !== true) results[results.length - 1].ok = false;
  const html = await check("/", "Production frontend", async (r) => {
    const body = await r.text();
    return body.includes('id="root"') && !body.includes("/@vite/client")
      ? body
      : false;
  });
  if (typeof html === "string") {
    const assets = [
      ...html.matchAll(/(?:src|href)="([^"\s]+\.(?:js|css))"/g),
    ].map((m) => m[1]);
    if (!assets.length)
      results.push({ label: "Built JS/CSS assets", ok: false });
    for (const asset of assets)
      await check(asset, "Built asset " + asset, (r) => {
        const type = r.headers.get("content-type") || "";
        return asset.endsWith(".css")
          ? type.includes("text/css")
          : type.includes("javascript");
      });
  }
  await check("/media/startup.mp4", "Startup MP4", (r) =>
    r.headers.get("content-type")?.startsWith("video/"),
  );
  await check("/media/startup-still.png", "Startup PNG", (r) =>
    r.headers.get("content-type")?.startsWith("image/"),
  );
  await check("/docs/pi-first-run.md", "Local installation guide", (r) =>
    r.headers.get("content-type")?.startsWith("text/plain"),
  );
  return {
    results,
    health: health && typeof health === "object" ? health : null,
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2),
      strict = args.includes("--require-ma");
    const address =
      args.find((a) => !a.startsWith("--")) || "http://127.0.0.1:3001";
    const { results, health } = await checkApplication(address);
    for (const result of results)
      console.log(`${result.ok ? "PASS" : "FAIL"} ${result.label}`);
    console.log(
      "Music Assistant:",
      health?.mode === "music-assistant"
        ? health.musicAssistant
        : "simulation (no live MA server tested)",
    );
    if (
      strict &&
      (health?.mode !== "music-assistant" ||
        health.musicAssistant !== "connected")
    ) {
      console.log("FAIL Live Music Assistant connection required");
      process.exitCode = 1;
    }
    if (results.some((r) => !r.ok)) process.exitCode = 1;
    let model = "not detected";
    try {
      model = (await readFile("/proc/device-tree/model", "utf8")).replaceAll(
        "\0",
        "",
      );
    } catch {}
    let drm = [];
    try {
      drm = await readdir("/dev/dri");
    } catch {}
    let target = "development checkout";
    try {
      target = (
        await readFile(new URL("../deployment-target", import.meta.url), "utf8")
      ).trim();
    } catch {}
    console.log(
      "Deployment target:",
      target,
      "· VM results do not certify Pi hardware.",
    );
    console.log("Host:", model, "· DRM devices:", drm.length);
    console.log(
      "UNVERIFIED: kiosk seat, display/touch, audio output, electrical safety and real hardware.",
    );
  } catch {
    console.error(
      "FAIL Diagnostics could not complete; check the app address and running service.",
    );
    process.exitCode = 1;
  }
}
