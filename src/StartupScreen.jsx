import React, { useEffect, useRef, useState } from "react";
/** Branding is independent from hardware readiness and never enables audio. */
export function StartupScreen({ mode, offline, preview = 0 }) {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [cycle, setCycle] = useState(0);
  const [visible, setVisible] = useState(true);
  const [elapsed, setElapsed] = useState(false);
  const [renderer, setRenderer] = useState(reduced ? "still" : "loading");
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
    setRenderer(reduced ? "still" : "loading");
  }, [cycle, preview]);
  useEffect(() => {
    if (!visible) return;
    // Slow VM decoders must not consume the whole animation window while loading.
    if (renderer === "loading") {
      const timer = setTimeout(() => setRenderer("fallback"), 1800);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setElapsed(true), 2800);
    return () => clearTimeout(timer);
  }, [renderer, cycle, preview, visible]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      setReduced(media.matches);
      if (media.matches) setRenderer("still");
    };
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
    if (!visible || reduced || renderer !== "loading") return;
    let current = true;
    video.current?.play()?.catch(() => {
      if (current) setRenderer("fallback");
    });
    return () => {
      current = false;
    };
  }, [visible, renderer, cycle, preview, reduced]);
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
      data-renderer={renderer}
    >
      <img
        key={`${cycle}-${preview}-${renderer}`}
        className={renderer === "fallback" ? "startup-logo-motion" : undefined}
        src="/media/startup-still.png"
        alt="ONE · DUTCHAUDIOWORKS"
      />
      {!reduced && !elapsed && ["loading", "video"].includes(renderer) && (
        <video
          key={`${cycle}-${preview}`}
          ref={video}
          style={{ visibility: renderer === "video" ? "visible" : "hidden" }}
          poster="/media/startup-still.png"
          muted
          autoPlay
          playsInline
          preload="auto"
          onPlaying={() => setRenderer("video")}
          onEnded={() => setElapsed(true)}
          onError={() => setRenderer("fallback")}
          aria-label="DAW ONE cold start video"
        >
          <source src="/media/startup.webm" type='video/webm; codecs="vp8"' />
          <source src="/media/startup.mp4" type="video/mp4" />
        </video>
      )}
      {elapsed && mode === "booting" && !offline && (
        <span>Starting device…</span>
      )}
    </section>
  );
}
