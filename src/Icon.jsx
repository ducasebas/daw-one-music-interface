import React from "react";
// TuneBox outline icons: one 24-unit grid, rounded caps and shared stroke tokens.
const paths = {
  wifi: "M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01",
  "wifi-off":
    "M2 2l20 20M7 5a16 16 0 0 1 15 3M2 8l2-1M5 12a11 11 0 0 1 4-2M15 11l4 1M8.5 16a5 5 0 0 1 7 0M12 20h.01",
  network:
    "M8 8l8 8M8 16l8-8M8 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0M22 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0M8 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0M22 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  discover: "M12 3l2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6Z",
  library: "M4 4v16M9 4v16M14 4v16M18 5l3 14",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  queue: "M4 6h16M4 12h12M4 18h8",
  rooms: "M12 3l9 6v12h-7v-7h-4v7H3V9Z",
  settings:
    "M9.5 3h5l.6 2.4 2 .9 2.1-1.2 2.5 4.3-1.8 1.7v2l1.8 1.7-2.5 4.3-2.1-1.2-2 .9-.6 2.2h-5l-.6-2.2-2-.9-2.1 1.2-2.5-4.3 1.8-1.7v-2L2.3 9.4l2.5-4.3 2.1 1.2 2-.9ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  film: "M3 4h18v16H3ZM7 4v16M17 4v16M3 8h4M3 16h4M17 8h4M17 16h4",
  play: "M7.7 4 20 12 7.7 20Z",
  pause:
    "M7.5 4h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z M14.5 4h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z",
  previous: "M5 5h2v14H5Z M18 5v14L8 12Z",
  next: "M17 5h2v14h-2Z M6 5l10 7L6 19Z",
  volume: "M3 9h4l5-5v16l-5-5H3ZM16 8q5 4 0 8M19 5q8 7 0 14",
  mute: "M3 9h4l5-5v16l-5-5H3ZM17 9l5 6M22 9l-5 6",
  back: "M15 4l-8 8 8 8",
  close: "M6 6l12 12M18 6L6 18",
  backspace: "M9 5h12v14H9L2 12ZM12 9l6 6M18 9l-6 6",
  radio:
    "M3 8h18v13H3ZM4 8l15-6M6 12h5M6 16h5M18 15a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  speaker:
    "M6 2h12v20H6ZM15 15a3 3 0 1 1-6 0 3 3 0 0 1 6 0M13 6a1 1 0 1 1-2 0 1 1 0 0 1 2 0",
};
export function Icon({ name, size = 20 }) {
  return (
    <svg
      className="tb-icon"
      data-icon={name}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="var(--icon-stroke,1.6)"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={paths[name] || "M4 4h16v16H4ZM8 8l8 8M16 8l-8 8"}
        fill={
          ["play", "pause", "previous", "next"].includes(name)
            ? "currentColor"
            : "none"
        }
        strokeWidth={
          ["play", "pause", "previous", "next"].includes(name) ? 0 : undefined
        }
      />
    </svg>
  );
}
