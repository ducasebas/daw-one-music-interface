import React, { useRef } from "react";
export function Pager({ label, items, index, onChange, children }) {
  const start = useRef(null);
  const move = (delta) =>
    onChange(Math.max(0, Math.min(items.length - 1, index + delta)));
  return (
    <section
      className="pager"
      aria-label={label}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "ArrowRight") {
          e.preventDefault();
          move(1);
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          move(-1);
        }
      }}
      onTouchStart={(e) => {
        start.current = null;
        if (
          e.touches.length !== 1 ||
          e.target.closest("input,select,textarea,button,a,label")
        )
          return;
        start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchCancel={() => {
        start.current = null;
      }}
      onTouchEnd={(e) => {
        const from = start.current;
        start.current = null;
        if (!from || e.changedTouches.length !== 1) return;
        const dx = e.changedTouches[0].clientX - from.x,
          dy = e.changedTouches[0].clientY - from.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5)
          move(dx < 0 ? 1 : -1);
      }}
    >
      <div className="pager-bar">
        <select
          aria-label={`${label} page`}
          value={index}
          onChange={(e) => onChange(+e.target.value)}
        >
          {items.map((title, i) => (
            <option key={title} value={i}>
              {String(i + 1).padStart(2, "0")} · {title}
            </option>
          ))}
        </select>
        <span className="page-count" aria-live="polite">
          {index + 1} / {items.length}
        </span>
        <span className="swipe-hint">SWIPE TO EXPLORE</span>
        <button
          aria-label={`Previous ${label} page`}
          disabled={index === 0}
          onClick={() => move(-1)}
        >
          ←
        </button>
        <button
          aria-label={`Next ${label} page`}
          disabled={index === items.length - 1}
          onClick={() => move(1)}
        >
          →
        </button>
      </div>
      <div className="page-body" data-page={items[index]}>
        {children}
      </div>
    </section>
  );
}
