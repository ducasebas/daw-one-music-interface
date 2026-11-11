import {tr} from "../shared/i18n.js";
import React from "react";
import { Icon } from "./Icon.jsx";
/** Shared presentation only: no driver, player or safety state lives in a skin. */
export function SkinPanel({ skin, theme, snapshot, offline }) {
  const { device, playback, sensors } = snapshot,
    simulated = snapshot.mode === "simulation";
  if (theme.diagnostics)
    return (
      <dl className="m2-telemetry" aria-label={tr("Apparaatdiagnostiek")}>
        <div>
          <dt>{tr("DEVICE")}</dt>
          <dd>{tr(offline ? "UNKNOWN" : device.mode)}</dd>
        </div>
        <div>
          <dt>{tr("TEMP · SIM")}</dt>
          <dd>{tr(offline ? "—" : `${sensors?.temperature ?? "—"} °C`)}</dd>
        </div>
        <div>
          <dt>{tr("AMP · SIM")}</dt>
          <dd>
            {tr(offline
              ? "UNKNOWN"
              : device.amplifierEnabled
                ? "ENABLED"
                : "INHIBITED")}
          </dd>
        </div>
        <div>
          <dt>{tr("POWER · SIM")}</dt>
          <dd>
            {tr(offline ? "UNKNOWN" : sensors?.powerGood ? "GOOD" : "NOT READY")}
          </dd>
        </div>
        <div>
          <dt>{tr("PLAYER")}</dt>
          <dd>
            {tr(offline
              ? "OFFLINE"
              : playback.connected
                ? "CONNECTED"
                : "UNAVAILABLE")}
          </dd>
        </div>
        <div>
          <dt>{tr("HARDWARE")}</dt>
          <dd>{tr("UNVERIFIED")}</dd>
        </div>
      </dl>
    );
  if (skin === "minimal-dark")
    return (
      <div className="m2-next-preview">
        <small>{tr("HIERNA")}</small>
        {playback.queue
          .slice(playback.index + 1, playback.index + 3)
          .map((t) => (
            <div key={t.id}>
              <strong>{t.title}</strong>
              <small>{t.artist}</small>
            </div>
          ))}
        {playback.index + 1 >= playback.queue.length && (
          <p>{tr("Einde van de wachtrij.")}</p>
        )}
      </div>
    );
  if (skin === "reference-dark" || skin === "warm-bronze")
    return (
      <div
        className="m2-level-panel"
        aria-label={tr("Stereoniveau niet beschikbaar")}
      >
        <div className="m2-level-pair">
          {["L", "R"].map((channel) => (
            <div className="m2-dial" key={channel}>
              <span>{tr(channel)}</span>
              <i />
            </div>
          ))}
        </div>
        <small>{tr("LEVEL SIGNAL UNAVAILABLE")}</small>
        <span>
          {tr(simulated ? "Gesimuleerde bediening" : "Spelerbediening")}{tr(" · geen audiosignaalmeting")}</span>
      </div>
    );
  if (skin === "champagne-gold")
    return (
      <div className="m2-output-card">
        <Icon name="speaker" size={24} />
        <small>{tr("GESELECTEERDE UITGANG")}</small>
        <strong>{tr(playback.playerName || "TuneBox")}</strong>
        <span>{tr(simulated ? "Simulatie · geen audio" : "Music Assistant")}</span>
        <small>{tr("Fysieke hardware niet geverifieerd")}</small>
      </div>
    );
  return (
    <div className="m2-cinema-note">
      <Icon name="film" size={28} />
      <small>{tr("THE LISTENING ROOM")}</small>
      <p>{tr("Een moment.")}<br />{tr("Alleen muziek.")}</p>
      <span>{tr("Artworkvoorbeeld · geen videostream")}</span>
    </div>
  );
}
