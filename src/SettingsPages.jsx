import {tr} from "../shared/i18n.js";
import { ScreenSettings } from "./WallExperience.jsx";
import {AudioSettings} from "./AudioVisualizer.jsx";
import {SetupWizard} from "./SetupWizard.jsx";
import { UpdateSettings } from "./UpdateSettings.jsx";
import { BootPanel } from "./BootPanel.jsx";
import React, { useState, useEffect } from "react";
import { Pager } from "./Pager.jsx";
import { MusicConnection } from "./MusicConnection.jsx";
import { ThemeSettings } from "./Themes.jsx";
import { DisplaySettings, SensorDashboard } from './DisplaySettings.jsx';
import { panelProfile } from '../shared/display.js';
import { LanguageSettings } from './LanguageSettings.jsx';
import { VideoSettings } from './VideoArtwork.jsx';
import {SettingsHub} from './SettingsHub.jsx';
import {PowerOffButton} from './PowerControls.jsx';
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
  "Setup",
  "Audio analysis",
  "Schermrust",
  "Video artwork",
  "Sensors",
  "Language",
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
  onPageChange,
  offline = false,
  onClose,
  onReplayStartup,
}) {
  const [index, setIndex] = useState(initialPage);
  useEffect(() => setIndex(initialPage), [initialPage]);
  useEffect(()=>onPageChange?.(index),[index,onPageChange]);
  const wall=panelProfile(location.search)==='wall-16-10';
  const groups=[['Playback',0],['Display',15],['Appearance',1],['Audio',14],['Video',16],['Connections',13],['Sensors',17],['Updates',12],['System',11],['Language',18]];
  const selected=groups.find(([_,id])=>id===index)||(index>=1&&index<=9?groups[2]:groups[5]);
  const body = (
    <Pager label={tr("Settings")} items={pages} index={index} onChange={setIndex}>
      {index === 0 ? (
        <div className="control-grid">
          {!wall&&<label>{tr("Display brightness ")}<output>{tr(prefs.brightness)}%</output>
            <input
              aria-label={tr("Display brightness")}
              type="range"
              min="10"
              max="100"
              value={prefs.brightness}
              onChange={(e) => update("brightness", +e.target.value)}
            />
          </label>}
          <label>{tr("Artwork mode")}<select
              aria-label={tr("Artwork mode")}
              value={prefs.artwork}
              onChange={(e) => update("artwork", e.target.value)}
            >
              <option value="cover">{tr("Album cover")}</option>
              <option value="video" disabled={prefs.lowPower}>{tr("Video artwork")}</option>
            </select>
          </label>
          <label>{tr("Manual video correction (seconds)")}<input
              aria-label={tr("Manual video correction")}
              type="number"
              min="-600"
              max="600"
              value={prefs.correction}
              onChange={(e) => update("correction", +e.target.value)}
            />
          </label>
          <label>{tr("Volume control")}<select
              aria-label={tr("Volume control")}
              value={prefs.volumeControl}
              onChange={(e) => update("volumeControl", e.target.value)}
            >
              <option value="linear">{tr("Touch slider")}</option>
              <option value="circular">{tr("Circular dial")}</option>
            </select>
          </label>
          {wall&&<label>{tr('Startup animation')}<select aria-label={tr('Startup animation')} value={prefs.startupAnimation||'auto'} onChange={e=>update('startupAnimation',e.target.value)}><option value="auto">{tr('Automatic')}</option><option value="video">{tr('Animation')}</option><option value="still">{tr('Still image')}</option></select></label>}
          {wall&&onReplayStartup&&<button onClick={onReplayStartup}>{tr('Replay startup')}</button>}
        </div>
      ) : pages[index] === "Schermrust" ? (
        wall?<DisplaySettings prefs={prefs} update={update} offline={offline}/>:<ScreenSettings prefs={prefs} update={update}/>
      ) : index===16 ? (
        <VideoSettings snapshot={snapshot} prefs={prefs} update={update} offline={offline}/>
      ) : index===17 ? (
        <SensorDashboard snapshot={snapshot} offline={offline}/>
      ) : index===18 ? (
        <LanguageSettings/>
      ) : pages[index] === "Audio analysis" ? (
        <AudioSettings prefs={prefs} update={update} offline={offline}/>
      ) : pages[index] === "Setup" ? (
        <SetupWizard snapshot={snapshot} offline={offline}/>
      ) : pages[index] === "Updates" ? (
        <UpdateSettings />
      ) : pages[index] === "Startup" ? (
        <>{wall&&<PowerOffButton offline={offline} label/>}<BootPanel
          snapshot={snapshot}
          onSnapshot={onSnapshot}
          offline={offline}
        /></>
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
  if(wall)return <SettingsHub snapshot={snapshot} offline={offline} prefs={prefs} update={update} themePreferences={themePreferences} setThemePreferences={setThemePreferences} onSnapshot={onSnapshot} onClose={onClose} initialPage={initialPage} onReplayStartup={onReplayStartup}/>;
  if(!wall)return body;
  return <div className="settings-hub" data-section={selected[1]}><nav className="settings-categories" aria-label={tr("Settings categories")}>{groups.map(([name,id])=><button key={id} aria-current={selected[1]===id?'page':undefined} onClick={()=>setIndex(id)}>{tr(name)}</button>)}</nav><section className="settings-detail" aria-label={tr(selected[0])}><header className="settings-detail-heading"><h2>{tr(selected[0])}</h2><button onClick={onClose}>{tr('Done')}</button></header>{selected[1]===1&&<label className="appearance-section">{tr("Appearance section")}<select aria-label={tr("Appearance section")} value={index} onChange={e=>setIndex(Number(e.target.value))}>{pages.slice(1,10).map((name,i)=><option key={name} value={i+1}>{tr(name)}</option>)}</select></label>}{tr(body)}</section></div>;
}
