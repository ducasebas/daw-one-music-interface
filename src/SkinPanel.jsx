import React from "react";
import { Icon } from "./Icon.jsx";
/** Shared presentation only: no driver, player or safety state lives in a skin. */
export function SkinPanel({ skin, theme, snapshot, offline }) {
  const { device, playback, sensors } = snapshot,
    simulated = snapshot.mode === "simulation";
  if (theme.diagnostics)
    return (
      <dl className="m2-telemetry" aria-label="Apparaatdiagnostiek">
        <div>
          <dt>DEVICE</dt>
          <dd>{offline ? "UNKNOWN" : device.mode}</dd>
        </div>
        <div>
          <dt>TEMP · SIM</dt>
          <dd>{offline ? "—" : `${sensors?.temperature ?? "—"} °C`}</dd>
        </div>
        <div>
          <dt>AMP · SIM</dt>
          <dd>
            {offline
              ? "UNKNOWN"
              : device.amplifierEnabled
                ? "ENABLED"
                : "INHIBITED"}
          </dd>
        </div>
        <div>
          <dt>POWER · SIM</dt>
          <dd>
            {offline ? "UNKNOWN" : sensors?.powerGood ? "GOOD" : "NOT READY"}
          </dd>
        </div>
        <div>
          <dt>PLAYER</dt>
          <dd>
            {offline
              ? "OFFLINE"
              : playback.connected
                ? "CONNECTED"
                : "UNAVAILABLE"}
          </dd>
        </div>
        <div>
          <dt>HARDWARE</dt>
          <dd>UNVERIFIED</dd>
        </div>
      </dl>
    );
  if (skin === "minimal-dark")
    return (
      <div className="m2-next-preview">
        <small>HIERNA</small>
        {playback.queue
          .slice(playback.index + 1, playback.index + 3)
          .map((t) => (
            <div key={t.id}>
              <strong>{t.title}</strong>
              <small>{t.artist}</small>
            </div>
          ))}
        {playback.index + 1 >= playback.queue.length && (
          <p>Einde van de wachtrij.</p>
        )}
      </div>
    );
  if (skin === "reference-dark" || skin === "warm-bronze")
    return (
      <div
        className="m2-level-panel"
        aria-label="Stereoniveau niet beschikbaar"
      >
        <div className="m2-level-pair">
          {["L", "R"].map((channel) => (
            <div className="m2-dial" key={channel}>
              <span>{channel}</span>
              <i />
            </div>
          ))}
        </div>
        <small>LEVEL SIGNAL UNAVAILABLE</small>
        <span>
          {simulated ? "Gesimuleerde bediening" : "Spelerbediening"} · geen
          audiosignaalmeting
        </span>
      </div>
    );
  if (skin === "champagne-gold")
    return (
      <div className="m2-output-card">
        <Icon name="speaker" size={24} />
        <small>GESELECTEERDE UITGANG</small>
        <strong>{playback.playerName || "TuneBox"}</strong>
        <span>{simulated ? "Simulatie · geen audio" : "Music Assistant"}</span>
        <small>Fysieke hardware niet geverifieerd</small>
      </div>
    );
  return (
    <div className="m2-cinema-note">
      <Icon name="film" size={28} />
      <small>THE LISTENING ROOM</small>
      <p>
        Een moment.
        <br />
        Alleen muziek.
      </p>
      <span>Artworkvoorbeeld · geen videostream</span>
    </div>
  );
}
