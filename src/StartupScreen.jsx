import React, { useEffect, useRef, useState } from "react";
/** Branding is independent from hardware readiness and never enables audio. */
export function StartupScreen({
  mode,
  offline,
  preview = 0,
  staticOnly = false,
}) {
  const [reduced, setReduced] = useState(
    () =>
      staticOnly ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [cycle, setCycle] = useState(0);
  const [visible, setVisible] = useState(true);
  const [elapsed, setElapsed] = useState(false);
  const [foreground, setForeground] = useState(
    document.visibilityState === "visible",
  );
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
    if (!visible || !foreground) return;
    // Slow VM decoders must not consume the whole animation window while loading.
    if (renderer === "loading") {
      const timer = setTimeout(() => setRenderer("fallback"), 8000);
      return () => clearTimeout(timer);
    }
    if (renderer === "primed") return;
    // Video ends on its media clock, not wall time. A frozen decoder can still recover.
    const timer =
      renderer === "video"
        ? setTimeout(() => setRenderer("fallback"), 12000)
        : setTimeout(() => setElapsed(true), 2800);
    return () => clearTimeout(timer);
  }, [renderer, cycle, preview, visible, foreground]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      setReduced(staticOnly || media.matches);
      if (staticOnly || media.matches) setRenderer("still");
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, [staticOnly]);
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
    const changed = () => {
      const next = document.visibilityState === "visible";
      setForeground(next);
      if (!visible) return;
      if (!next) video.current?.pause();
      else setCycle((v) => v + 1); // A hidden startup must replay from the beginning.
    };
    document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
  }, [visible]);
  useEffect(() => {
    if (!visible || reduced || !foreground || renderer !== "primed") return;
    let first, second, timer;
    let current = true;
    // Paint the paused first frame before starting its media clock. No autoplay race.
    first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        timer = setTimeout(() => {
          if (!current || !video.current) return;
          video.current.currentTime = 0;
          video.current.play().catch(() => {
            if (current) setRenderer("fallback");
          });
        }, 300);
      });
    });
    return () => {
      current = false;
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      clearTimeout(timer);
    };
  }, [visible, renderer, cycle, preview, reduced, foreground]);
  const prime = (event) => {
    if (renderer !== "loading" || event.currentTarget.readyState < 2) return;
    event.currentTarget.pause();
    event.currentTarget.currentTime = 0;
    setRenderer("primed");
  };
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
        style={{
          visibility: ["loading", "primed", "video"].includes(renderer)
            ? "hidden"
            : "visible",
        }}
        src="/media/startup-still.png"
        alt="ONE · DUTCHAUDIOWORKS"
      />
      {!reduced &&
        !elapsed &&
        ["loading", "primed", "video"].includes(renderer) && (
          <video
            key={`${cycle}-${preview}`}
            ref={video}
            style={{
              visibility: renderer !== "loading" ? "visible" : "hidden",
            }}
            muted
            playsInline
            preload="auto"
            onLoadedData={prime}
            onCanPlay={prime}
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
