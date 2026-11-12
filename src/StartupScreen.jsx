import {tr} from "../shared/i18n.js";
import { useStartupPreparation } from "./useStartupPreparation.js";
import React, { useEffect, useRef, useState } from "react";
import {useDeviceUpdates} from './DeviceUpdates.jsx';
const startupSources=['/media/startup.mp4','/media/startup.webm'];
const stillPolicy=(staticOnly,animationMode,motion)=>animationMode==='still'||animationMode==='off'||animationMode!=='video'&&(staticOnly||motion);
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
      stillPolicy(staticOnly,animationMode,window.matchMedia("(prefers-reduced-motion: reduce)").matches),
  );
  const [cycle, setCycle] = useState(0);
  const [visible, setVisible] = useState(true);
  const [elapsed, setElapsed] = useState(false);
  const [foreground, setForeground] = useState(
    document.visibilityState === "visible",
  );
  const [renderer, setRenderer] = useState(reduced ? "still" : "loading");
  const [sourceIndex,setSourceIndex]=useState(0);
  const failure=useRef(null),progress=useRef({time:0,frames:0}),lastReport=useRef(0);
  const report=()=>{
    const v=video.current;
    if(v){const quality=v.getVideoPlaybackQuality?.();progress.current={time:Math.round(v.currentTime*100)/100,frames:quality?.totalVideoFrames??null,droppedFrames:quality?.droppedVideoFrames??null};}
    try{localStorage.setItem('tunebox-startup-status',JSON.stringify({renderer,source:['still','fallback'].includes(renderer)?'/media/startup-still.png':startupSources[sourceIndex],animationMode,staticOnly,reduced,reason:animationMode==='off'?'disabled':animationMode==='still'?'still-selected':reduced?(staticOnly?'low-power-auto':'reduced-motion'):failure.current,...progress.current,at:Date.now()}));}catch{}
  };
  const nextSource=(reason)=>{
    failure.current=typeof reason==='string'?reason:video.current?.error?`media-error-${video.current.error.code}`:'playback-did-not-advance';
    if(sourceIndex<startupSources.length-1){setSourceIndex(sourceIndex+1);setRenderer('loading');}
    else setRenderer('fallback');
  };
  useEffect(()=>{
    report();
    if(animationMode!=='off'&&renderer==='loading'&&visible||!updates?.info?.controlToken)return;
    const frame=requestAnimationFrame(()=>requestAnimationFrame(()=>{
      fetch('/api/display/ready',{method:'POST',headers:{'X-TuneBox-Control':updates.info.controlToken}}).catch(()=>{});
    }));
    return()=>cancelAnimationFrame(frame);
  },[renderer,visible,sourceIndex,updates?.info?.controlToken]);
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
    setSourceIndex(0);
    setRenderer(reduced ? "still" : "loading");
    failure.current=null;progress.current={time:0,frames:0};
  }, [cycle, preview]);
  useEffect(() => {
    if (!visible || !foreground) return;
    // Slow VM decoders must not consume the whole animation window while loading.
    if (renderer === "loading") {
      const timer = setTimeout(nextSource, 8000);
      return () => clearTimeout(timer);
    }
    if (renderer === "primed") {
      const timer=setTimeout(nextSource,6000);
      return()=>clearTimeout(timer);
    }
    // Video ends on its media clock, not wall time. A frozen decoder can still recover.
    const timer =
      renderer === "video"
        ? setTimeout(nextSource, 12000)
        : setTimeout(() => setElapsed(true), 2800);
    return () => clearTimeout(timer);
  }, [renderer, sourceIndex, cycle, preview, visible, foreground]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      const still=stillPolicy(staticOnly,animationMode,media.matches);
      setReduced(still);
      setRenderer(old=>still?'still':old==='still'?'loading':old);
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
          video.current.play().catch(error => {if(current)nextSource('play-rejected-'+(error.name||'unknown'));});
        }, 300);
      });
    });
    return () => {
      current = false;
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      clearTimeout(timer);
    };
  }, [visible, renderer, sourceIndex, cycle, preview, reduced, foreground]);
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
        alt={tr("TuneBox · DUTCHAUDIOWORKS")}
      />
      {!reduced &&
        !elapsed &&
        ["loading", "primed", "video"].includes(renderer) && (
          <video
            key={`${cycle}-${preview}-${sourceIndex}`}
            ref={video}
            src={startupSources[sourceIndex]}
            style={{
              visibility: renderer !== "loading" ? "visible" : "hidden",
            }}
            muted
            playsInline
            preload="auto"
            onLoadedData={prime}
            onCanPlay={prime}
            onPlaying={() => setRenderer("video")}
            onTimeUpdate={()=>{if(performance.now()-lastReport.current>500){lastReport.current=performance.now();report();}}}
            onEnded={() => {report();setElapsed(true);}}
            onError={nextSource}
            aria-label={tr("TuneBox cold start video")}
          />
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

export function StartupDiagnostics(){
 const [status,setStatus]=useState(null);
 useEffect(()=>{const read=()=>{try{setStatus(JSON.parse(localStorage.getItem('tunebox-startup-status')));}catch{}};read();const t=setInterval(read,1000);return()=>clearInterval(t);},[]);
 return <details className="startup-diagnostics"><summary>{tr('Splash diagnostics')}</summary>{status?<dl><dt>{tr('Renderer')}</dt><dd>{status.renderer}</dd><dt>{tr('Source')}</dt><dd>{status.source}</dd><dt>{tr('Playback time')}</dt><dd>{status.time??0}s · {status.frames??'—'} {tr('decoded frames')} · {status.droppedFrames??'—'} {tr('dropped frames')}</dd><dt>{tr('Reason')}</dt><dd>{status.reason||'—'}</dd></dl>:<p>{tr('Replay startup to collect diagnostics.')}</p>}</details>;
}
