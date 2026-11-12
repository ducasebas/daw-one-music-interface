import {tr} from "../shared/i18n.js";
import { useStartupPreparation } from "./useStartupPreparation.js";
import React, { useEffect, useRef, useState } from "react";
import {useDeviceUpdates} from './DeviceUpdates.jsx';
/** Branding is independent from hardware readiness and never enables audio. */
export function StartupScreen({
  mode,
  offline,
  preview = 0,
  staticOnly = false,
  animationMode = 'auto',
  boot,
}) {
  const updates=useDeviceUpdates();
  const preparation = useStartupPreparation();
  const [reduced, setReduced] = useState(
    () =>
      staticOnly || animationMode==='still'||animationMode==='off' ||
      (animationMode!=='video'&&window.matchMedia("(prefers-reduced-motion: reduce)").matches),
  );
  const [cycle, setCycle] = useState(0);
  const [visible, setVisible] = useState(true);
  const [elapsed, setElapsed] = useState(false);
  const [foreground, setForeground] = useState(
    document.visibilityState === "visible",
  );
  const [renderer, setRenderer] = useState(reduced ? "still" : "loading");
  useEffect(()=>{
    try{localStorage.setItem('tunebox-startup-status',JSON.stringify({renderer,staticOnly,reduced,at:Date.now()}));}catch{}
    if(animationMode!=='off'&&renderer==='loading'&&visible||!updates?.info?.controlToken)return;
    const frame=requestAnimationFrame(()=>requestAnimationFrame(()=>{
      fetch('/api/display/ready',{method:'POST',headers:{'X-TuneBox-Control':updates.info.controlToken}}).catch(()=>{});
    }));
    return()=>cancelAnimationFrame(frame);
  },[renderer,visible,updates?.info?.controlToken]);
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
    if (renderer === "primed") {
      const timer=setTimeout(()=>setRenderer('fallback'),6000);
      return()=>clearTimeout(timer);
    }
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
      const still=staticOnly||animationMode==='still'||animationMode==='off'||animationMode!=='video'&&media.matches;
      setReduced(still);
      if (still) setRenderer("still");
    };
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, [staticOnly,animationMode]);
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
  if (!visible||animationMode==='off') return null;
  return (
    <section
      className="startup-screen"
      style={{pointerEvents:'auto'}}
      onPointerDown={event=>{event.preventDefault();event.stopPropagation();if(mode!=='booting')setVisible(false);}}
      aria-label={tr("Startup animation")}
      role="status"
      data-renderer={renderer}
      data-preparation={preparation}
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
        alt={tr("ONE · DUTCHAUDIOWORKS")}
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
            aria-label={tr("DAW ONE cold start video")}
          >
            <source src="/media/startup.mp4" type="video/mp4" />
            <source src="/media/startup.webm" type='video/webm; codecs="vp8"' />
          </video>
        )}
      <small className="startup-check-caption">
        {tr(offline
          ? "Offline · lokale instellingen beschikbaar"
          : boot
            ? `${boot.simulated ? "SIMULATIE · " : ""}${boot.checks.filter((c) => c.status === "pass").length} controles OK · ${boot.phase}`
            : "Lokale interface voorbereiden…")}
      </small>
      {elapsed && mode === "booting" && !offline && (
        <span>{tr("Starting device…")}</span>
      )}
    </section>
  );
}
