import {tr} from "../shared/i18n.js";
import React, { useRef, useState } from "react";
export function VolumeControl({
  value,
  muted = false,
  onValue,
  onMute,
  disabled = false,
  muteDisabled = false,
  limit = 100,
  live = false,
}) {
  const drag = useRef(null),
    [draft, setDraft] = useState(null);
  const actual = Number.isFinite(value) ? value : null,
    shown = draft ?? actual,
    clip = (v) => Math.max(0, Math.min(limit, Math.round(v)));
  const adjust = (v) => {
    if (!disabled) onValue(clip(v));
  };
  return (
    <div className="volume-control reference-volume">
      <div
        className="volume-dial reference-volume-scale"
        role="slider"
        aria-label={tr("Volume")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={actual ?? 0}
        aria-valuetext={
          actual === null
            ? "Unavailable"
            : `${shown} percent${muted ? ", muted" : ""}`
        }
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        style={{
          "--volume-angle": `${(shown ?? 0) * 2.7}deg`,
          "--volume-percent": `${shown ?? 0}%`,
        }}
        onKeyDown={(e) => {
          const delta = {
            ArrowUp: 1,
            ArrowRight: 1,
            ArrowDown: -1,
            ArrowLeft: -1,
            PageUp: 5,
            PageDown: -5,
          }[e.key];
          if (delta !== undefined) {
            e.preventDefault();
            adjust((actual ?? 0) + delta);
          }
          if (e.key === "Home") {
            e.preventDefault();
            adjust(0);
          }
          if (e.key === "End") {
            e.preventDefault();
            adjust(limit);
          }
        }}
        onPointerDown={(e) => {
          if (disabled || e.button !== 0) return;
          drag.current = {
            y: e.clientX,
            value: actual ?? 0,
            last: actual ?? 0,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const d = drag.current;
          d.last = clip(d.value + (e.clientX - d.y) / 2);
          setDraft(d.last);
        }}
        onPointerUp={(e) => {
          if (!drag.current) return;
          const d = drag.current;
          drag.current = null;
          setDraft(null);
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
          if (d.last !== d.value) adjust(d.last);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDraft(null);
        }}
      >
        <div className="dial-face reference-face">
          <strong>
            {tr(shown ?? "—")}
            <small>%</small>
          </strong>
          <span>
            {tr(muted
              ? "MUTED"
              : draft !== null
                ? "RELEASE TO SET"
                : live
                  ? "PLAYER VOLUME"
                  : "PREVIEW")}
          </span>
          <b style={{ transform: `rotate(${(shown ?? 0) * 2.7 - 135}deg)` }} />
        </div>
      </div>
      <div className="volume-buttons">
        <button
          aria-label={tr("Decrease volume")}
          disabled={disabled || actual === null}
          onClick={() => adjust((actual ?? 0) - 1)}
        >
          −
        </button>
        <button
          aria-label={tr(muted ? "Unmute" : "Mute")}
          disabled={muteDisabled || disabled}
          aria-pressed={muted}
          onClick={onMute}
        >
          {tr(muted ? "◌" : "◉")}
        </button>
        <button
          aria-label={tr("Increase volume")}
          disabled={disabled || actual === null}
          onClick={() => adjust((actual ?? 0) + 1)}
        >
          +
        </button>
      </div>
      <span className="volume-caption">
        {tr(live ? `LIVE PLAYER · LIMIT ${limit}%` : "SIMULATED OUTPUT")}
      </span>
    </div>
  );
}
