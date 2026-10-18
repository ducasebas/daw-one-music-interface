import React, { useEffect, useRef, useState } from "react";
/** Branding playback is independent from boot readiness and every hardware gate. */
export function StartupScreen({ mode, offline, preview = 0 }) {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [cycle, setCycle] = useState(0),
    [visible, setVisible] = useState(true),
    [elapsed, setElapsed] = useState(false),
    [fallback, setFallback] = useState(false);
  const previous = useRef(mode),
    video = useRef(null);
  useEffect(() => {
    if (mode === "booting" && previous.current !== "booting")
      setCycle((v) => v + 1);
    previous.current = mode;
  }, [mode]);
  useEffect(() => {
    setVisible(true);
    setElapsed(false);
    setFallback(reduced);
    const timer = setTimeout(() => setElapsed(true), 2800);
    return () => clearTimeout(timer);
  }, [cycle, preview]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)"),
      change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!visible || mode === "booting") return;
    const skip = () => setVisible(false);
    window.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip);
    return () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    };
  }, [visible, mode]);
  useEffect(() => {
    if (reduced) return;
    let current = true;
    video.current?.play()?.catch(() => {
      if (current) setFallback(true);
    });
    return () => {
      current = false;
    };
  }, [cycle, preview]);
  useEffect(() => {
    if (
      mode === "fault" ||
      mode === "shutting-down" ||
      (elapsed && (mode !== "booting" || offline))
    )
      setVisible(false);
  }, [mode, offline, elapsed]);
  if (!visible) return null;
  return (
    <section
      className="startup-screen"
      aria-label="Startup animation"
      role="status"
    >
      <img src="/media/startup-still.png" alt="ONE · DUTCHAUDIOWORKS" />
      {!reduced && !fallback && !elapsed && (
        <video
          key={`${cycle}-${preview}`}
          ref={video}
          src="/media/startup.mp4"
          poster="/media/startup-still.png"
          muted
          autoPlay
          playsInline
          preload="auto"
          onError={() => setFallback(true)}
          aria-label="DAW ONE cold start video"
        />
      )}
      {elapsed && mode === "booting" && !offline && (
        <span>Starting device…</span>
      )}
    </section>
  );
}
