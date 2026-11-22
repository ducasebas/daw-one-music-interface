import {tr} from "../shared/i18n.js";
import React, { useState, useEffect, useRef } from "react";
import { Icon } from "./Icon.jsx";
const safeSrc=src=>typeof src === "string" && /^\/api\/artwork\/[a-f0-9]{64}$/.test(src);
/** Only same-origin opaque IDs emitted by the backend; fallback is never fake cover art.
 * A new cover replaces the old one only once it has loaded (short fade), so a track change never shows a blank square.
 * `loading` overlays a calm progress ring while a skip is being confirmed. */
export function Artwork({ src, alt = "", className = "", loading = false }) {
  const [failed, setFailed] = useState(false),[shownSrc,setShownSrc]=useState(safeSrc(src)?src:null),[fresh,setFresh]=useState(false),pending=useRef(null);
  useEffect(() => {
    setFailed(false);
    if(!safeSrc(src)){setShownSrc(null);return;}
    if(src===shownSrc)return;
    // Preload the next cover; swap only when it is decoded.
    const img=new Image();pending.current=img;img.decoding="async";
    img.onload=()=>{if(pending.current===img){setShownSrc(src);setFresh(true);}};
    img.onerror=()=>{if(pending.current===img){setShownSrc(src);setFailed(true);}};
    img.src=src;
    return()=>{img.onload=null;img.onerror=null;};
  }, [src]);
  const waiting=loading||(safeSrc(src)&&src!==shownSrc&&!failed);
  return (
    <div className={`real-artwork ${className}`} data-loading={waiting||undefined} aria-busy={waiting||undefined}>
      {shownSrc && !failed ? (
        <img
          key={shownSrc}
          className={fresh?"artwork-fade-in":undefined}
          onAnimationEnd={()=>setFresh(false)}
          src={shownSrc}
          alt={tr(alt)}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-label={tr("Geen albumhoes")}>
          <Icon name="library" size={26} />
          <small>{tr("Geen albumhoes")}</small>
        </span>
      )}
      {waiting&&<i className="artwork-loading" role="status" aria-label={tr("Loading the next track…")}/>}
    </div>
  );
}
