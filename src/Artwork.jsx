import {tr} from "../shared/i18n.js";
import React, { useState, useEffect } from "react";
import { Icon } from "./Icon.jsx";
/** Only same-origin opaque IDs emitted by the backend; fallback is never fake cover art. */
export function Artwork({ src, alt = "", className = "" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const safe =
    typeof src === "string" && /^\/api\/artwork\/[a-f0-9]{64}$/.test(src);
  return (
    <div className={`real-artwork ${className}`}>
      {safe && !failed ? (
        <img
          src={src}
          alt={tr(alt)}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-label={tr("Geen albumhoes")}>
          <Icon name="library" size={26} />
          <small>{tr("Geen albumhoes")}</small>
        </span>
      )}
    </div>
  );
}
