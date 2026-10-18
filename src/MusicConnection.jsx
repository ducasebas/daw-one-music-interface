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
      aria-label="Music Assistant connection"
    >
      <div className="control-grid">
        <div>
          <b>
            {snapshot.mode === "music-assistant"
              ? "MUSIC ASSISTANT"
              : "SIMULATION"}
          </b>
          <p>
            {status.status || "Live connection not configured"} ·{" "}
            {status.serverVersion || "Server version unknown"}
          </p>
          <small>
            Hardware remains simulated. Live controls target the selected
            external player.
          </small>
        </div>
        <label>
          Music Assistant player
          <select
            aria-label="Music Assistant player"
            value={status.playerId || ""}
            disabled={!status.connected}
            onChange={(e) => select(e.target.value)}
          >
            <option value="">Select a player explicitly</option>
            {status.players?.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.available}>
                {p.name}
                {!p.available ? " · unavailable" : ""}
              </option>
            ))}
          </select>
        </label>
        <p>
          {status.controlEnabled ? "Control enabled" : "Read-only"} · Volume
          ceiling {status.volumeLimit ?? "—"}%<br />
          {status.error ||
            "Configure URL and credentials on the backend, never in the browser."}
        </p>
        <p role="status">
          {message ||
            "See docs/music-assistant.md for setup and local-network access."}
        </p>
      </div>
    </section>
  );
}
