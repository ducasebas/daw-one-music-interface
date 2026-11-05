import { useState, useEffect } from "react";
/** Only current branding/font; bounded, cancellable, never blocks navigation/audio. */
export function useStartupPreparation() {
  const [status, setStatus] = useState("preparing");
  useEffect(() => {
    let active = true;
    const timers = [];
    let cover;
    const bounded = (promise) =>
      Promise.race([
        promise,
        new Promise((resolve) =>
          timers.push(setTimeout(() => resolve(false), 4000)),
        ),
      ]);
    const font = bounded(
      document.fonts
        ?.load("400 16px Manrope")
        .then((fonts) => fonts.length > 0)
        .catch(() => false) || Promise.resolve(false),
    );
    const image = bounded(
      new Promise((resolve) => {
        cover = new Image();
        cover.onload = () => resolve(true);
        cover.onerror = () => resolve(false);
        cover.src = "/media/startup-still.png";
      }),
    );
    Promise.all([font, image]).then((results) => {
      if (active) setStatus(results.every(Boolean) ? "ready" : "fallback");
    });
    return () => {
      active = false;
      timers.forEach(clearTimeout);
      if (cover) {
        cover.onload = null;
        cover.onerror = null;
      }
    };
  }, []);
  return status;
}
