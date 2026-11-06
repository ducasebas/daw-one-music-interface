import { UpdateSettings } from "./UpdateSettings.jsx";
import { BootPanel } from "./BootPanel.jsx";
import React, { useState, useEffect } from "react";
import { Pager } from "./Pager.jsx";
import { MusicConnection } from "./MusicConnection.jsx";
import { ThemeSettings } from "./Themes.jsx";
const pages = [
  "General",
  "Skins",
  "Palette",
  "Accents",
  "Typography",
  "Finish",
  "Automation",
  "Schedule",
  "State mapping",
  "Save theme",
  "Connection",
  "Startup",
  "Updates",
];
export function SettingsPages({
  snapshot,
  onSnapshot,
  prefs,
  update,
  themePreferences,
  theme,
  setThemePreferences,
  initialPage = 0,
  offline = false,
}) {
  const [index, setIndex] = useState(initialPage);
  useEffect(() => setIndex(initialPage), [initialPage]);
  return (
    <Pager label="Settings" items={pages} index={index} onChange={setIndex}>
      {index === 0 ? (
        <div className="control-grid">
          <label>
            Display brightness <output>{prefs.brightness}%</output>
            <input
              aria-label="Display brightness"
              type="range"
              min="10"
              max="100"
              value={prefs.brightness}
              onChange={(e) => update("brightness", +e.target.value)}
            />
          </label>
          <label>
            Artwork mode
            <select
              aria-label="Artwork mode"
              value={prefs.artwork}
              onChange={(e) => update("artwork", e.target.value)}
            >
              <option value="cover">Album cover</option>
              <option value="video" disabled={prefs.lowPower}>
                Video artwork · mock
              </option>
            </select>
          </label>
          <label>
            Manual video correction (seconds)
            <input
              aria-label="Manual video correction"
              type="number"
              min="-600"
              max="600"
              value={prefs.correction}
              onChange={(e) => update("correction", +e.target.value)}
            />
          </label>
          <label>
            Volume control
            <select
              aria-label="Volume control"
              value={prefs.volumeControl}
              onChange={(e) => update("volumeControl", e.target.value)}
            >
              <option value="linear">Touch slider</option>
              <option value="circular">Circular dial</option>
            </select>
          </label>
        </div>
      ) : pages[index] === "Updates" ? (
        <UpdateSettings />
      ) : pages[index] === "Startup" ? (
        <BootPanel
          snapshot={snapshot}
          onSnapshot={onSnapshot}
          offline={offline}
        />
      ) : pages[index] === "Connection" ? (
        <MusicConnection snapshot={snapshot} onSnapshot={onSnapshot} />
      ) : (
        <ThemeSettings
          section={pages[index]}
          preferences={themePreferences}
          theme={theme}
          onChange={setThemePreferences}
        />
      )}
    </Pager>
  );
}
