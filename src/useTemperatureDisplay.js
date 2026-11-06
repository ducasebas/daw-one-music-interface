import { useRef, useState, useEffect } from "react";
import { smoothTemperature } from "../shared/sensor-display.js";
export function useTemperatureDisplay(reading, offline) {
  const previous = useRef(null),
    [value, setValue] = useState(null);
  const good =
    !offline && reading?.status === "ok" && Number.isFinite(reading.value);
  useEffect(() => {
    if (!good) {
      previous.current = null;
      setValue(null);
      return;
    }
    previous.current = smoothTemperature(
      previous.current,
      reading.value,
      reading.observedAt ?? Date.now(),
    );
    setValue(previous.current?.value ?? null);
  }, [good, reading?.value, reading?.observedAt]);
  return good ? value : null;
}
