import { readFileSync } from "node:fs";
import { websocketUrl } from "./ma-transport.js";
export function musicConfig(env = process.env) {
  const mode = env.DAW_PLAYBACK_MODE || "simulation";
  if (!["simulation", "music-assistant"].includes(mode))
    throw Error("Invalid DAW_PLAYBACK_MODE");
  if (mode === "simulation") return { mode };
  if (!env.MA_URL) throw Error("Set MA_URL for live music mode");
  websocketUrl(env.MA_URL);
  const limit =
    env.MA_VOLUME_LIMIT === undefined ? 40 : Number(env.MA_VOLUME_LIMIT);
  if (!Number.isInteger(limit) || limit < 0 || limit > 100)
    throw Error("MA_VOLUME_LIMIT must be an integer 0–100");
  let token = env.MA_TOKEN || "";
  if (env.MA_TOKEN_FILE) token = readFileSync(env.MA_TOKEN_FILE, "utf8").trim();
  return {
    mode,
    url: env.MA_URL,
    token,
    playerId: env.MA_PLAYER_ID || "",
    controlEnabled: env.MA_ALLOW_CONTROL === "true",
    volumeLimit: limit,
  };
}
