import {AudioVisualizer} from "./AudioVisualizer.jsx";
import React from "react";
export function StereoMeters() {
  return (
    <div className="stereo-meters" aria-label="Audio meters unavailable">
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
              {channel}
            </text>
          </svg>
        </div>
      ))}
      <small>LEVEL SIGNAL UNAVAILABLE</small>
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
      <section className="reference-diagnostics" aria-label="Nerd diagnostics">
        <h2>SYSTEM & DIAGNOSTICS</h2>
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
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  if (["minimal-dark", "cinematic"].includes(layout))
    return (
      <section className="reference-up-next" aria-label="Upcoming tracks">
        <h2>
          UP NEXT{" "}
          <span>{Math.max(0, p.queue.length - p.index - 1)} tracks</span>
        </h2>
        {p.queue.slice(p.index + 1, p.index + 4).map((t, i) => (
          <article key={t.id}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            <div>
              <b>{t.title}</b>
              <small>{t.artist}</small>
            </div>
          </article>
        ))}
        {p.queue.length <= p.index + 1 && <p>No upcoming tracks</p>}
      </section>
    );
  if (layout === "champagne-gold")
    return (
      <section className="reference-options">
        <div>
          <small>SOURCE</small>
          <b>{live ? "Music Assistant" : "Mock library"}</b>
        </div>
        <div>
          <small>ZONE / OUTPUT</small>
          <b>{p.playerName || "Simulated stereo player"}</b>
        </div>
        <div>
          <small>DSP PRESET</small>
          <b>Unavailable</b>
        </div>
        <label>
          <small>BRIGHTNESS · {prefs.brightness}%</small>
          <input
            aria-label="Display brightness"
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
