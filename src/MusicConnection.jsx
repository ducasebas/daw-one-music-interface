import {tr} from "../shared/i18n.js";
import React, { useState } from "react";
export function MusicConnection({ snapshot, onSnapshot }) {
  const [message, setMessage] = useState("");
  const status = snapshot.musicAssistant || {};
  async function select(id) {
    try {
      const r = await fetch("/api/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      onSnapshot(data);
      setMessage("Player selected; no playback or volume command sent");
    } catch (e) {
      setMessage(e.message);
    }
  }
  return (
    <section
      className="connection-page"
      aria-label={tr("Music Assistant connection")}
    >
      <div className="control-grid">
        <div>
          <b>
            {tr(snapshot.mode === "music-assistant"
              ? "MUSIC ASSISTANT"
              : "SIMULATION")}
          </b>
          <p>
            {tr(status.status || "Live connection not configured")} ·{tr(" ")}
            {tr(status.serverVersion || "Server version unknown")}
          </p>
          <small>{tr("Hardware remains simulated. Live controls target the selected external player.")}</small>
        </div>
        <label>{tr("Music Assistant player")}<select
            aria-label={tr("Music Assistant player")}
            value={status.playerId || ""}
            disabled={!status.connected}
            onChange={(e) => select(e.target.value)}
          >
            <option value="">{tr("Select a player explicitly")}</option>
            {status.players?.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.available}>
                {tr(p.name)}
                {tr(!p.available ? " · unavailable" : "")}
              </option>
            ))}
          </select>
        </label>
        <p>
          {tr(status.controlEnabled ? "Control enabled" : "Read-only")}{tr(" · Volume ceiling ")}{tr(status.volumeLimit ?? "—")}%<br />
          {tr(status.error ||
            "Configure URL and credentials on the backend, never in the browser.")}
        </p>
        <p role="status">
          {tr(message ||
            "See docs/music-assistant.md for setup and local-network access.")}
        </p>
      </div>
    </section>
  );
}
