import {tr} from "../shared/i18n.js";
import React, { useLayoutEffect, useRef, useState } from "react";
import { displayGeometry, panelProfile } from "../shared/display.js";
/** The actual product, with fixed logical dimensions; no second app or API client. */
export function DisplayViewport({ mode, children }) {
  const host = useRef(null);
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setSize(entry.contentRect),
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const geometry = displayGeometry(mode, size.width, size.height, panelProfile(location.search));
  return (
    <div
      ref={host}
      className="display-viewport"
      data-display-mode={mode}
      data-panel={panelProfile(location.search)}
      aria-label={tr("Production display viewport")}
    >
      <div
        className="display-frame"
        style={{
          width: geometry.renderedWidth,
          height: geometry.renderedHeight,
        }}
      >
        <div
          className="virtual-display-surface"
          style={{ width: geometry.width, height: geometry.height, transform: `scale(${geometry.scale})` }}
        >
          {tr(children)}
        </div>
      </div>
    </div>
  );
}
