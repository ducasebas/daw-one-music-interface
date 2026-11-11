import {tr} from "../shared/i18n.js";
import {AudioVisualizer} from "./AudioVisualizer.jsx";
import React from "react";
export function StereoMeters() {
  return (
    <div className="stereo-meters" aria-label={tr("Audio meters unavailable")}>
      {["L", "R"].map((channel) => (
        <div className="stereo-meter" key={channel}>
          <svg viewBox="0 0 150 88" aria-hidden="true">
            <path d="M12 65 Q75 -3 138 65" fill="none" />
            <path
              className="meter-ticks"
              d="M17 60l-4-6m15-5l-3-7m17-3l-2-8m18-1l-1-8m18 7v-8m17 9l2-8m15 14l3-7m12 16l4-6"
            />
            <text x="20" y="40">
              −40
            </text>
            <text x="57" y="22">
              −10
            </text>
            <text x="99" y="32">
              0
            </text>
            <text x="133" y="53">
              +6
            </text>
            <text x="75" y="78" textAnchor="middle">
              {tr(channel)}
            </text>
          </svg>
        </div>
      ))}
      <small>{tr("LEVEL SIGNAL UNAVAILABLE")}</small>
    </div>
  );
}
export function ReferenceAside({ layout, snapshot, prefs, update }) {
  const p = snapshot.playback,
    s = snapshot.sensors || {},
    live = snapshot.mode === "music-assistant";
  if(prefs.visualizer&&prefs.visualizer!=="off")return <AudioVisualizer mode={prefs.visualizer} bands={prefs.visualizerBands}/>;
  if (layout === "nerd-mode")
    return (
      <section className="reference-diagnostics" aria-label={tr("Nerd diagnostics")}>
        <h2>{tr("SYSTEM & DIAGNOSTICS")}</h2>
        <dl>
          {[
            ["Source", live ? "Music Assistant" : "Mock library"],
            ["Player", p.playerName || "Simulated player"],
            ["Audio format", "Unavailable"],
            ["Speaker impedance", "Not measured"],
            ["Amplifier power", "Not measured"],
            ["Temperature", `${s.temperature ?? "—"} °C · simulated`],
            [
              "Network",
              s.wifi ? "Available · simulated" : "Unavailable · simulated",
            ],
            ["CPU / RAM", "Not measured"],
            [
              "Power-good",
              s.powerGood ? "True · simulated" : "False · simulated",
            ],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{tr(k)}</dt>
              <dd>{tr(v)}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  if (["minimal-dark", "cinematic"].includes(layout))
    return (
      <section className="reference-up-next" aria-label={tr("Upcoming tracks")}>
        <h2>{tr("UP NEXT")}{tr(" ")}
          <span>{tr(Math.max(0, p.queue.length - p.index - 1))}{tr(" tracks")}</span>
        </h2>
        {p.queue.slice(p.index + 1, p.index + 4).map((t, i) => (
          <article key={t.id}>
            <span>{tr(String(i + 1).padStart(2, "0"))}</span>
            <div>
              <b>{t.title}</b>
              <small>{t.artist}</small>
            </div>
          </article>
        ))}
        {p.queue.length <= p.index + 1 && <p>{tr("No upcoming tracks")}</p>}
      </section>
    );
  if (layout === "champagne-gold")
    return (
      <section className="reference-options">
        <div>
          <small>{tr("SOURCE")}</small>
          <b>{tr(live ? "Music Assistant" : "Mock library")}</b>
        </div>
        <div>
          <small>{tr("ZONE / OUTPUT")}</small>
          <b>{tr(p.playerName || "Simulated stereo player")}</b>
        </div>
        <div>
          <small>{tr("DSP PRESET")}</small>
          <b>{tr("Unavailable")}</b>
        </div>
        <label>
          <small>{tr("BRIGHTNESS · ")}{tr(prefs.brightness)}%</small>
          <input
            aria-label={tr("Display brightness")}
            type="range"
            min="10"
            max="100"
            value={prefs.brightness}
            onChange={(e) => update("brightness", +e.target.value)}
          />
        </label>
      </section>
    );
  return <StereoMeters />;
}
