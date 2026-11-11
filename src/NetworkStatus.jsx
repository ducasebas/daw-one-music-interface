import {tr} from "../shared/i18n.js";
import React, { useRef, useEffect, useState } from "react";
import { wifiReading } from "../shared/wall.js";
import { Icon } from "./Icon.jsx";
export function NetworkStatus({ snapshot, offline }) {
  const root = useRef(null);
  const [network,setNetwork]=useState(null);
  useEffect(()=>{
    let active=true,timer,controller;
    async function read(){
      if(document.visibilityState==='visible'&&!offline){
        controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),5000);
        try{const r=await fetch('/api/network',{signal:controller.signal});if(!r.ok)throw Error();const n=await r.json();if(active)setNetwork(n);}
        catch{if(active)setNetwork(null);}finally{clearTimeout(timeout);}
      }else if(active)setNetwork(null);
      if(active)timer=setTimeout(read,30000);
    }
    read();return()=>{active=false;clearTimeout(timer);controller?.abort();};
  },[offline]);
  const reading=wifiReading(network,offline);

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
      data-signal={reading.level===null?"unavailable":reading.level}
    >
      <summary aria-label={tr("Netwerkstatus")}>
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
        <span>{tr(label)}{tr(reading.level!==null ? ` · ${reading.label}${reading.simulated ? " sim" : ""}` : "")}</span>
      </summary>
      <div className="m2-network-info">
        <strong>{tr(label)}</strong>
        <p>
          {tr(offline
            ? "Geen verbinding met de app-backend."
            : simulated
              ? "Deze netwerkstatus is gesimuleerd."
              : `De app-backend is bereikbaar. ${snapshot.musicAssistant?.connected ? "Music Assistant is verbonden." : "Music Assistant is niet verbonden."}`)}
        </p>
        <small>
          {tr(reading.level===null ? "Wi-Fi-signaalsterkte niet gemeten. Een werkende appverbinding kan ook via ethernet lopen." : `Wi-Fi-signaalsterkte ${reading.label} · ${reading.simulated ? "gesimuleerd" : "NetworkManager-meting (maximaal 30 s oud)"}`)}

        </small>
      </div>
    </details>
  );
}
