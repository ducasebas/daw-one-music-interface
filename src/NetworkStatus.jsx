import React, { useRef, useEffect } from "react";
import { Icon } from "./Icon.jsx";
export function NetworkStatus({ snapshot, offline }) {
  const root = useRef(null);
  useEffect(() => {
    const outside = (e) => {
      if (root.current && !root.current.contains(e.target))
        root.current.open = false;
    };
    const escape = (e) => {
      if (e.key === "Escape" && root.current?.open) {
        root.current.open = false;
        root.current.querySelector("summary").focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const simulated = snapshot.mode === "simulation",
    wifi = simulated ? snapshot.sensors?.wifi : null;
  const label = offline
    ? "Geen verbinding"
    : simulated
      ? wifi === false
        ? "Netwerk uit · sim"
        : "Netwerk · sim"
      : "App verbonden";
  return (
    <details
      ref={root}
      className="m2-network"
      data-state={offline || wifi === false ? "unavailable" : "connected"}
      data-signal="unavailable"
    >
      <summary aria-label="Netwerkstatus">
        <Icon
          name={
            offline || wifi === false
              ? "wifi-off"
              : simulated
                ? "wifi"
                : "network"
          }
          size={18}
        />
        <span>{label}</span>
      </summary>
      <div className="m2-network-info">
        <strong>{label}</strong>
        <p>
          {offline
            ? "Geen verbinding met de app-backend."
            : simulated
              ? "Deze netwerkstatus is gesimuleerd."
              : `De app-backend is bereikbaar. ${snapshot.musicAssistant?.connected ? "Music Assistant is verbonden." : "Music Assistant is niet verbonden."}`}
        </p>
        <small>
          Wi-Fi-signaalsterkte niet gemeten. Een werkende appverbinding kan ook
          via ethernet lopen.
        </small>
      </div>
    </details>
  );
}
