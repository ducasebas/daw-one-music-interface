import {tr} from "../shared/i18n.js";
import React, { useRef, useState, useEffect } from "react";
import { Icon } from "./Icon.jsx";
import {
  clampVolume,
  linearVolume,
  knobAngle,
  knobVolume,
  rotateVolume,
} from "../shared/volume.js";
/** One shared serialized lane: at most one request plus the latest desired value. */
export function useVolumeRequests(send) {
  const next = useRef(null),
    running = useRef(false),
    sender = useRef(send),
    [target, setTarget] = useState(null);
  sender.current = send;
  const request = async (value) => {
    next.current = value;
    setTarget(value);
    if (running.current) return;
    running.current = true;
    try {
      while (next.current !== null) {
        const value = next.current;
        next.current = null;
        const ok = await sender.current({ type: "volume", value });
        if (ok === false) {
          next.current = null;
          break;
        }
      }
    } finally {
      running.current = false;
      setTarget(null);
    }
  };
  return { request, target };
}
export function TouchVolume({
  value,
  muted = false,
  target = null,
  onValue,
  disabled = false,
  limit = 100,
  mode = "linear",
  label = "Volume",
}) {
  const [draft, setDraft] = useState(null),
    gesture = useRef(null),
    latest = useRef({ value, disabled, limit });
  latest.current = { value, disabled, limit };
  const actual = Number.isFinite(value) ? value : null,
    shown = draft ?? target ?? actual;
  useEffect(() => {
    if (disabled) {
      gesture.current = null;
      setDraft(null);
    }
  }, [disabled]);
  const finish = (event, cancel = false) => {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    setDraft(null);
    if (!cancel && !latest.current.disabled && g.changed)
      onValue(clampVolume(g.value, latest.current.limit));
  };
  const max = Math.max(0, Math.min(100, limit)),
    clipped = clampVolume(shown ?? 0, max);
  const change = (v) => {
    if (!disabled) onValue(clampVolume(v, max));
  };
  return (
    <div className={`touch-volume touch-volume-${mode}`} data-muted={muted}>
      <div className="touch-volume-readout">
        <strong>
          {tr(shown ?? "—")}
          <small>%</small>
        </strong>
        <span>
          {tr(draft !== null
            ? "Adjusting volume"
            : target !== null
              ? "Adjusting volume"
              : actual === null
                ? "Niet beschikbaar"
                : actual > max
                  ? `Speler · limiet ${max}%`
                  : muted
                    ? "Gedempt · waarde behouden"
                    : "Volume")}
        </span>
      </div>
      <div
        className="touch-volume-slider"
        role="slider"
        aria-label={tr(label)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={clipped}
        aria-valuetext={`${shown ?? "Onbekend"} procent${muted ? ", gedempt" : ""}${target !== null ? ", wordt verstuurd" : ""}${actual > max ? `, bedieningslimiet ${max} procent` : ""}`}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        style={{
          "--touch-volume-progress": `${max ? (clipped / max) * 100 : 0}%`,
          "--touch-volume-angle": `${max ? (clipped / max) * 270 - 135 : -135}deg`,
        }}
        onPointerDown={(e) => {
          if (disabled || gesture.current || !e.isPrimary || e.button !== 0)
            return;
          const rect = e.currentTarget.getBoundingClientRect(),
            angle = knobAngle(e.clientX, e.clientY, rect);
          const scale = rect.width / e.currentTarget.offsetWidth;
          const inset = 12 * scale;
          const centerDrag =
            mode === "circular" &&
            Math.hypot(
              e.clientX - (rect.left + rect.width / 2),
              e.clientY - (rect.top + rect.height / 2),
            ) <
              rect.width * .22;
          const start = centerDrag
            ? null
            : mode === "circular"
              ? knobVolume(angle, max)
              : linearVolume(
                  e.clientX,
                  rect.left + inset,
                  rect.width - 2 * inset,
                  max,
                );
          const v = start ?? clampVolume(shown ?? 0, max);
          gesture.current = {
            id: e.pointerId,
            centerDrag,
            scale,
            inset,
            startY: e.clientY,
            startValue: shown ?? 0,
            rect,
            angle,
            value: v,
            changed: start !== null && v !== (shown ?? 0),
            sentAt: 0,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
          setDraft(v);
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g || g.id !== e.pointerId) return;
          const a = knobAngle(e.clientX, e.clientY, g.rect);
          g.value = g.centerDrag
            ? Math.max(
                0,
                Math.min(
                  max,
                  g.startValue + (g.startY - e.clientY) / (1.5 * g.scale),
                ),
              )
            : mode === "circular"
              ? rotateVolume(g.value, g.angle, a, max)
              : linearVolume(
                  e.clientX,
                  g.rect.left + g.inset,
                  g.rect.width - 2 * g.inset,
                  max,
                );
          g.angle = a;
          g.changed = true;
          setDraft(clampVolume(g.value, max));
          // Keep one serialized request in flight and coalesce intermediate moves.
          if(performance.now()-g.sentAt>=80){g.sentAt=performance.now();onValue(clampVolume(g.value,max));}
        }}
        onPointerUp={(e) => finish(e)}
        onPointerCancel={(e) => finish(e, true)}
        onLostPointerCapture={(e) => finish(e, true)}
        onKeyDown={(e) => {
          if (disabled) return;
          const delta = {
            ArrowUp: 1,
            ArrowRight: 1,
            ArrowDown: -1,
            ArrowLeft: -1,
            PageUp: 5,
            PageDown: -5,
          }[e.key];
          if (delta !== undefined || ["Home", "End"].includes(e.key)) {
            e.preventDefault();
            change(
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? max
                  : (shown ?? 0) + delta,
            );
          }
        }}
      >
        {mode === "circular" ? (
          <>
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <path
                className="touch-volume-arc"
                d="M12.2 51.8a28 28 0 1 1 39.6 0"
              />
              <path
                className="touch-volume-arc-fill"
                pathLength="100"
                strokeDasharray={`${max ? (clipped / max) * 100 : 0} 100`}
                d="M12.2 51.8a28 28 0 1 1 39.6 0"
              />
            </svg>
            <span className="touch-volume-needle" />
          </>
        ) : (
          <span className="touch-volume-track">
            <span />
            <i />
          </span>
        )}
      </div>
      <button
        className="touch-volume-step"
        aria-label={tr(`${label} lager`)}
        disabled={disabled}
        onClick={() => change((shown ?? 0) - 1)}
      >
        −
      </button>
      <button
        className="touch-volume-step"
        aria-label={tr(`${label} hoger`)}
        disabled={disabled}
        onClick={() => change((shown ?? 0) + 1)}
      >
        +
      </button>
    </div>
  );
}
