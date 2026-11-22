import {tr,translateFormat} from "../shared/i18n.js";
import { panelProfile } from "../shared/display.js";
import { WallControls, SleepSurface } from "./WallExperience.jsx";
import {StartupJoin} from './StartupJoin.jsx';
import {AudioVisualizer} from "./AudioVisualizer.jsx";
import {GlobalUpdateProgress,useDeviceUpdates} from "./DeviceUpdates.jsx";
import { LiveLibrary } from "./LiveLibrary.jsx";
import { Artwork } from "./Artwork.jsx";
import { bootPhaseLabels } from "./BootPanel.jsx";
import {HomeReadouts} from './SystemDashboard.jsx';
import { NetworkStatus } from "./NetworkStatus.jsx";
import { BuildBadge } from "./BuildBadge.jsx";
import { TouchVolume, useVolumeRequests } from "./TouchVolume.jsx";
import {controlVolumeLimit} from '../shared/volume.js';
import React, { useState, useRef, useEffect, useCallback } from "react";
const headerHideMs = 6000;
import { flushSync } from "react-dom";
import { SkinPanel } from "./SkinPanel.jsx";
import { presets } from "../shared/themes.js";
import { themeVariables } from "../shared/themes.js";
import { tracks } from "../shared/playback.js";
import {SettingsPages} from './DeferredPanels.jsx';
import { Icon } from "./Icon.jsx";
import { StartupScreen } from "./StartupScreen.jsx";
import { PlaybackSeekControl } from "./SeekControl.jsx";
import { VideoArtwork } from './VideoArtwork.jsx';
import {KeyboardField} from './TouchKeyboard.jsx';
import {settingsSections} from '../shared/interface.js';
import {Rooms} from './Rooms.jsx';
import {BluetoothPairing} from './BluetoothReceiver.jsx';
import {NowPlayingBackdrop,NowPlayingWidgets} from './NowPlayingExtras.jsx';
import {PartySheet} from './PartySheet.jsx';
import {LocalControl} from './LocalControl.jsx';

const duration = (n) =>
  Number.isFinite(n)
    ? `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`
    : "Live";
const sections = [
  ["playing", "Now Playing"],
  ["discover", "Ontdek"],
  ["library", "Mijn muziek"],
  ["search", "Zoeken"],
  ["queue", "Wachtrij"],
  ["rooms", "Ruimtes"],
];
const categories = [
  "Albums",
  "Artiesten",
  "Nummers",
  "Playlists",
  "Radio",
  "Favorieten",
];
function Cover({ index = 0, small = false }) {
  return (
    <div
      aria-hidden="true"
      className={`m2-cover m2-cover-${index % 3} ${small ? "m2-small" : ""}`}
    >
      <i />
      <span>{tr("TUNEBOX")}<br />{tr("SESSIONS ")}{tr(String(index + 1).padStart(2, "0"))}
      </span>
    </div>
  );
}
import {startSkipHold,observeSkip,skipHoldMs} from '../shared/skip-hold.js';
export function MusicShell({
  snapshot,
  offline,
  send,
  prefs,
  update,
  theme,
  themePreferences,
  setThemePreferences,
  setSnapshot,
  notice,
  startupPreview,
  onReplayStartup,
}) {
  const deviceUpdates=useDeviceUpdates();
  const [startupReady,setStartupReady]=useState(false);
  const [security,setSecurity]=useState(null);
  useEffect(()=>{let live=true;const read=()=>fetch('/api/security/status').then(r=>r.ok?r.json():null).then(v=>{if(live)setSecurity(v);}).catch(()=>{});read();const timer=setInterval(read,15000);return()=>{live=false;clearInterval(timer);};},[]);
  const wall = panelProfile(location.search) === "wall-16-10";

  const [sleepPreview,setSleepPreview] = useState(false),[canSleep,setCanSleep]=useState(false);
  useEffect(()=>{
    if(snapshot.device.displayAwake!==false){
      setCanSleep(true);
      if(!offline)setSleepPreview(false);
    }
  },[snapshot.device.displayAwake,offline]);
  const sleeping = wall && (sleepPreview || (canSleep && !offline && snapshot.device.displayAwake === false));
  const [waking,setWaking]=useState(false);
  const wake = async () => {
    if(waking)return;
    setWaking(true);
    const begin=performance.now();
    const ok=offline?true:await send({type:'activity'});
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,180-(performance.now()-begin))));
    if(ok!==false)setSleepPreview(false);
    setWaking(false);
  };
  const sleep = async () => {
    setSleepPreview(true);
    if(!offline&&await send({type:'display-timeout'})===false)setSleepPreview(false);
  };

  const [liveViews, setLiveViews] = useState({});
  const [party,setParty]=useState(false);
  const [settingsPage, setSettingsPage] = useState(0);
  const [page, setPage] = useState(wall?"playing":"discover"),
    [category, setCategory] = useState("Albums"),
    [detail, setDetail] = useState(null),
    [query, setQuery] = useState(""),
    [keyboard, setKeyboard] = useState(true),
    [offset, setOffset] = useState(0),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false),
    [pendingAction,setPendingAction]=useState(null),
    [searchCycle,setSearchCycle]=useState(0);
  const video=prefs.artwork==='video';
  // 3.16: on the wall's Now Playing page the header slides up after a few quiet seconds; a small tab brings it back.
  const headerOverride=(()=>{try{return localStorage.getItem('tunebox.headerAutoHide');}catch{return null;}})();
  const autoHideHeader = wall && startupReady && page === "playing" && !sleeping && prefs.headerAutoHide !== false && headerOverride !== "off";
  const [headerHidden,setHeaderHidden]=useState(false);
  const headerTimer=useRef(null);
  const showHeader=useCallback(()=>{clearTimeout(headerTimer.current);setHeaderHidden(false);if(autoHideHeader)headerTimer.current=setTimeout(()=>setHeaderHidden(true),headerHideMs);},[autoHideHeader]);
  useEffect(()=>{showHeader();return()=>clearTimeout(headerTimer.current);},[showHeader]);
  const prompted=useRef(false);
  useEffect(()=>{const manager=deviceUpdates?.info?.manager;if(!prompted.current&&manager?.managed&&!manager.simulated&&manager.setupComplete===false){prompted.current=true;setSettingsPage(13);setPage("settings");}},[deviceUpdates?.info?.manager?.managed,deviceUpdates?.info?.manager?.setupComplete]);
  const [favorites, setFavorites] = useState(() => {
    try {
      const v = JSON.parse(
        localStorage.getItem("tunebox-example-favorites") || "[]",
      );
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(
        "tunebox-example-favorites",
        JSON.stringify(favorites),
      );
    } catch {
      setMessage("Favorieten kunnen niet worden opgeslagen.");
    }
  }, [favorites]);
  const bluetooth=snapshot.bluetooth,bluetoothActive=bluetooth?.active===true,phone=bluetooth?.devices?.find(d=>d.connected);
  const lock = useRef(false),
    device = snapshot.device,
    playback = bluetoothActive?{connected:bluetooth.available,playing:false,position:0,observedAt:0,index:0,queue:[{id:'bluetooth',title:phone?.title||'Bluetooth audio',artist:phone?.artist||phone?.name||'Connect your phone',album:'',duration:null}],volume:bluetooth.volume,muted:bluetooth.volume===0,playerName:'Bluetooth',capabilities:['volume_set']}:snapshot.playback,
    current = playback.queue[playback.index],
    simulated = !bluetoothActive&&snapshot.mode === "simulation",
    available = !offline && playback.connected,
    control =
      available && (bluetoothActive || simulated || snapshot.musicAssistant?.controlEnabled),
    volume = simulated ? (snapshot.audio?.volume ?? 32) : playback.volume,
    muted = simulated ? snapshot.audio?.muted : playback.muted;
  const [skipHold,setSkipHold]=useState(null),[,setSkipTick]=useState(0);
  const skipView=observeSkip(skipHold,current,Date.now()),shown=skipView.display||current,skipLoading=skipView.loading;
  useEffect(()=>{if(skipView.hold!==skipHold)setSkipHold(skipView.hold);},[skipView.hold,skipHold]);
  useEffect(()=>{if(!skipHold)return;const t=setTimeout(()=>setSkipTick(v=>v+1),skipHold.phase==='holding'?skipHoldMs+50:2600);return()=>clearTimeout(t);},[skipHold]);
  const volumeRequests = useVolumeRequests(event=>send(bluetoothActive?{...event,sourceId:bluetooth.sessionId}:event));
  const canVolume =
    control &&
    Number.isFinite(volume) &&
    (simulated || playback.capabilities?.includes("volume_set"));
  const animation = useRef(null);
  const returnTo = useRef({ page: "discover", detail: null });
  const [direction, setDirection] = useState("crossfade");
  function navigate(change, motion = "crossfade") {
    animation.current?.skipTransition();
    const commit = () => {
      setDirection(motion);
      change();
    };
    if (
      !wall && !prefs.lowPower &&
      document.startViewTransition &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      // Direction belongs to the transition snapshots; keep it off global CSS state.
      document.documentElement.dataset.tuneboxMotion = motion;
      animation.current = document.startViewTransition(() => flushSync(commit));
      animation.current.finished.catch(() => {});
    } else commit();
  }
  const go = (id) => {
    if(page==='settings'&&id!=='settings'&&window.tuneboxBeforeSettingsLeave){window.tuneboxBeforeSettingsLeave(()=>{navigate(()=>{setPage(id);setDetail(null);setMessage('');});});return;} 
    if (id === "playing" && page !== "playing")
      returnTo.current = { page, detail };
    navigate(() => {
      setPage(id);
      setDetail(null);
      setMessage("");
    });
  };
  useEffect(()=>{const show=e=>{if(typeof e.detail==='string')setMessage(e.detail.slice(0,200));};window.addEventListener('tunebox-notice',show);return()=>window.removeEventListener('tunebox-notice',show);},[]);
  const lastButtonWake=useRef(null);
  useEffect(()=>{
    const id=snapshot.navigation?.buttonWakeId;
    if(!id||id===lastButtonWake.current)return;
    lastButtonWake.current=id;
    setSleepPreview(false);
    go('playing');
  },[snapshot.navigation?.buttonWakeId]);
  const back = () => {
    navigate(() => {
      if (page === "playing") {
        setPage(returnTo.current.page);
        setDetail(returnTo.current.detail);
      } else setDetail(null);
    }, "back");
  };
  async function command(event) {
    if (lock.current) return;
    lock.current = true;
    // Skipping: keep showing this track with a loading state until the new one arrives (no flash back).
    if(['next','previous'].includes(event.type))setSkipHold(startSkipHold(current,Date.now()));
    setPending(true);setPendingAction(event.type);
    setMessage("");
    try {
      await send(event);
    } finally {
      lock.current = false;
      setPending(false);setPendingAction(null);
    }
  }
  async function toggleVisualizer(){
    const next=prefs.visualizer==='off'?'spectrum':prefs.visualizer==='spectrum'?'meters':'off';
    update('artwork','cover');
    if(next!=='off'&&!offline){
      try{
        const r=await fetch('/api/audio?watch=1');if(!r.ok)throw Error();const audio=await r.json();
        if(!audio.configured){setSettingsPage(14);go('settings');return;}
        if(!audio.enabled){const enabled=await fetch('/api/audio/settings',{method:'POST',headers:{'Content-Type':'application/json','X-TuneBox-Control':deviceUpdates?.info?.controlToken||''},body:JSON.stringify({enabled:true})});if(!enabled.ok)throw Error();}
      }catch{setMessage('Audio analysis is unavailable. Open Audio settings.');return;}
    }
    update('visualizer',next);
  }
  const sample = tracks.filter((t) =>
    `${t.title} ${t.artist} ${t.album}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  const choose = (t) => {
    navigate(() => {
      setDetail(t);
      setOffset(0);
    }, "forward");
  };
  const act = (t, next = false) => {
    const id = playback.queue.find((q) => q.title === t.title)?.id;
    if (!id) {
      setMessage("Dit voorbeeld is niet meer beschikbaar in de wachtrij.");
      return;
    }
    command({ type: "queue-add", id, next });
  };
  const title = detail
    ? detail.album
    : page === "playing"
      ? "Nu spelen"
      : page === "settings"
        ? "Instellingen"
        : sections.find((s) => s[0] === page)?.[1];
  const cards = (list = tracks) => (
    <div className="m2-cards">
      {list.map((t, i) => (
        <button key={t.id} className="m2-card" onClick={() => choose(t)}>
          <Cover index={i} />
          <strong>{category === "Artiesten" ? t.artist : t.album}</strong>
          <small>{t.artist}</small>
        </button>
      ))}
    </div>
  );
  return (
    <main
      className={"music2"+(page==="settings"&&(wall||settingsPage>=12)?" immersive-settings":"")+(page==="settings"&&wall?" compact-header":"")}
      data-panel={wall ? "wall-16-10" : "legacy-wide"}
      onContextMenu={e=>{if(!e.target.closest('input,textarea,[contenteditable="true"]'))e.preventDefault();}}
      onDragStart={e=>{if(e.target.tagName==='IMG')e.preventDefault();}}
      onPointerDownCapture={sleeping ? e=>{e.preventDefault();e.stopPropagation();wake();}:undefined}
      onKeyDownCapture={sleeping ? e=>{e.preventDefault();e.stopPropagation();wake();}:undefined}
      data-theme={theme.id}
      data-page={page}
      data-header={autoHideHeader&&headerHidden?"hidden":"shown"}
      data-performance={prefs.lowPower ? "pi3" : "standard"}
      data-skin={
        presets.some((p) => p.id === theme.id) ? theme.id : "reference-dark"
      }
      data-diagnostics={theme.diagnostics}
      style={{
        ...themeVariables(theme),
        "--brightness": wall ? 1 : prefs.brightness / 100,
      }}
      data-motion={direction}
    >
      <GlobalUpdateProgress />
      {wall&&(page==='settings'||page==='playing'&&!bluetoothActive&&!video)&&<NowPlayingBackdrop snapshot={snapshot} prefs={prefs} offline={offline}/>}
      {(sleeping||waking) && <SleepSurface prefs={prefs} snapshot={snapshot} offline={offline} wake={wake} waking={waking} />}

      <StartupScreen
        mode={device.mode}
        offline={offline}
        preview={startupPreview}
        staticOnly={prefs.lowPower}
        animationMode={prefs.startupAnimation}
        boot={snapshot.boot}
        onComplete={setStartupReady}
      />
      <StartupJoin active={wall&&startupReady&&!offline&&!sleeping&&(!snapshot.onboardingRequired||snapshot.preferences?.setupDeferred)&&snapshot.mode==='music-assistant'&&!['settings','rooms'].includes(page)&&!['installing','restarting','checking-health','rolling-back'].includes(deviceUpdates.info?.status)} controlToken={deviceUpdates.info?.controlToken} onSnapshot={setSnapshot} onRooms={()=>go('rooms')} onUnlock={()=>{setSettingsPage(21);go('settings');}}/>
      {autoHideHeader&&headerHidden&&<button className="m2-header-pull" aria-label={tr("Show menu")} onClick={showHeader}><Icon name="back" size={22} className="m2-header-pull-icon"/></button>}
      <header className="m2-header" aria-hidden={autoHideHeader&&headerHidden?true:undefined} inert={autoHideHeader&&headerHidden} onPointerDownCapture={autoHideHeader?showHeader:undefined}>
        <button className="m2-brand" onClick={() => go("playing")} aria-label={tr("Now Playing")}>{tr("DAW ")}<b>{tr("TuneBox")}</b>
        </button>
        <nav aria-label={tr("Muzieknavigatie")}>
          {sections.map(([id, label]) => (
            <button
              key={id}
              aria-label={tr(label)}
              aria-current={page === id ? "page" : undefined}
              onClick={() => go(id)}
            >
              <Icon name={id} />
              {tr(label)}
            </button>
          ))}
        </nav>
        <NetworkStatus snapshot={snapshot} offline={offline} />
        {wall && <WallControls snapshot={snapshot} offline={offline} prefs={prefs} updates={deviceUpdates} security={security}
          onSleep={sleep}
          onNavigate={id=>{const target=id==='status'?'system':id==='screen'?'display':id;const section=settingsSections.find(s=>s[0]===target);if(section){setSettingsPage(section[3]);go('settings');}else go(id);}} />}

        <button
          aria-label={tr("Instellingen")} aria-current={page==='settings'?'page':undefined}
          onClick={() => {
            setSettingsPage(0);
            go("settings");
          }}
        >
          <Icon name="settings" />{(deviceUpdates?.info?.available||security?.enabled&&!security.unlocked)&&<i className="attention-dot"/>}
        </button>
      </header>
      <div className="m2-heading" data-detail={detail?"true":undefined}>
        <div>
          {detail && (
            <button
              className="m2-back"
              aria-label={
                tr(page === "playing"
                  ? "Terug naar muziek"
                  : "Terug naar overzicht")
              }
              onClick={back}
            >
              <Icon name="back" />
            </button>
          )}
          <h1>{tr(title)}</h1>
          {page === "discover" && !detail && (
            <span>{tr("Jouw volgende ontdekking.")}</span>
          )}
        </div>
        <div className="m2-version-status" hidden={wall}>
          <div className="m2-build-boot">
            <button
              className="boot-shortcut"
              aria-label={tr("Open opstartcontrole")}
              onClick={() => {
                setSettingsPage(11);
                go("settings");
              }}
            >
              {tr(offline
                ? "Offline"
                : bootPhaseLabels[snapshot.boot?.phase] || "Opstartstatus")}
            </button>
            <BuildBadge snapshot={snapshot} offline={offline} />
          </div>
          <small className={offline ? "m2-warning" : ""}>
            {tr(offline
              ? "Offline · instellingen beschikbaar"
              : simulated
                ? "● SIMULATIE · VOORBEELDBIBLIOTHEEK"
                : "● MUSIC ASSISTANT · LIVE BIBLIOTHEEK")}
          </small>
        </div>
      </div>
      <section
        className="m2-content"
        aria-label={tr(title)}
        key={`${page}-${detail?.id || "list"}`}
      >
        {!simulated && ["discover", "library", "search"].includes(page) ? (
          <LiveLibrary
            view={page}
            snapshot={snapshot}
            offline={offline}
            onSnapshot={setSnapshot}
            onPlaying={() => go("playing")}
            onConfigure={()=>{setSettingsPage(13);go('settings');}}
            state={liveViews[page] || {}}
            onState={(state) => setLiveViews((v) => ({ ...v, [page]: state }))}
          />
        ) : detail ? (
          <div className="m2-detail">
            <Cover index={tracks.findIndex((t) => t.id === detail.id)} />
            <div>
              <small>{tr("VOORBEELDALBUM · ")}{detail.artist}</small>
              <h2>{detail.album}</h2>
              <p>
                {detail.title} · {tr(duration(detail.duration))}
              </p>
              <div className="m2-actions">
                <button
                  aria-pressed={favorites.includes(detail.id)}
                  onClick={() =>
                    setFavorites((f) =>
                      f.includes(detail.id)
                        ? f.filter((id) => id !== detail.id)
                        : [...f, detail.id],
                    )
                  }
                >
                  <Icon name="heart" size={16} />{tr(" ")}
                  {tr(favorites.includes(detail.id)
                    ? "Favoriet opgeslagen"
                    : "Bewaar favoriet")}
                </button>
                <button
                  className="m2-primary"
                  disabled={!control || !simulated || pending}
                  onClick={() => {
                    command({
                      type: "queue-select",
                      id: playback.queue.find((t) => t.title === detail.title)
                        ?.id,
                    });
                    go("playing");
                  }}
                >
                  <Icon name="play" size={16} />{tr(" Speel nu")}</button>
                <button
                  disabled={!control || !simulated || pending}
                  onClick={() => act(detail, true)}
                >{tr("Als volgende")}</button>
                <button
                  disabled={!control || !simulated || pending}
                  onClick={() => act(detail)}
                >{tr("Voeg toe aan einde")}</button>
              </div>
              <p className="m2-subtle">{tr("Voorbeeldselectie · echte albums en aanbevelingen volgen via de NUC.")}</p>
            </div>
          </div>
        ) : page === "discover" ? (
          <div className={"discover-wrap "+(snapshot.preferences?.dashboard?.visible?.length?"has-readouts":"")}><HomeReadouts snapshot={snapshot} offline={offline}/><div className="m2-discover">
            <button
              className="m2-feature"
              onClick={() => {
                setCategory("Playlists");
                go("library");
              }}
            >
              <small>{tr("VOOR JOU / VOORBEELD")}</small>
              <h2>{tr("Laat de avond")}<br />{tr("maar beginnen.")}</h2>
              <span>{tr("Rustige ontdekkingen, grote klanken.")}</span>
              <div className="m2-feature-orb" />
            </button>
            <div className="m2-discover-right">
              <div className="m2-section-label">{tr("Verder luisteren ")}<span>{tr("Spotify & Tidal · concept")}</span>
              </div>
              {tr(cards())}
              <div className="m2-note">{tr("Persoonlijke aanbevelingen sluiten we later aan op Music Assistant op de NUC.")}</div>
            </div>
          </div>
        </div>) : page === "library" ? (
          <div className="m2-library">
            <div className="m2-filters">
              {categories.map((c) => (
                <button
                  key={c}
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                >
                  {tr(c)}
                </button>
              ))}
            </div>
            {category === "Radio" ? (
              <div className="m2-empty">
                <Icon name="radio" size={30} />
                <h2>{tr("Een wereld aan stations.")}</h2>
                <p>{tr("Je favoriete stations verschijnen hier zodra de radiobron is gekoppeld.")}</p>
                <small>{tr("Geen radiostream verbonden · voorbeeldscherm")}</small>
              </div>
            ) : category === "Nummers" ? (
              <div className="m2-list">
                {tracks.map((t, i) => (
                  <button key={t.id} onClick={() => choose(t)}>
                    <span>0{tr(i + 1)}</span>
                    <strong>{t.title}</strong>
                    <span>{t.artist}</span>
                    <small>{tr(duration(t.duration))} ›</small>
                  </button>
                ))}
              </div>
            ) : category === "Favorieten" ? (
              favorites.length ? (
                cards(tracks.filter((t) => favorites.includes(t.id)))
              ) : (
                <div className="m2-empty">
                  <h2>{tr("Jouw muziek, dichtbij.")}</h2>
                  <p>{tr("Open een voorbeeldalbum en kies Bewaar favoriet.")}</p>
                </div>
              )
            ) : (
              cards()
            )}
          </div>
        ) : page === "search" ? (
          <div className="m2-search">
            <div className="m2-search-results">
              {wall?<div className="live-search-field"><KeyboardField key={searchCycle} label="Search music" value={query} onChange={setQuery} autoOpen maxLength={120}/><button onClick={()=>{setQuery('');setSearchCycle(v=>v+1);}}>{tr('New search')}</button></div>:<label className="m2-searchbox">
                <Icon name="search" />
                <input
                  aria-label={tr("Zoek muziek")}
                  value={query}
                  placeholder={tr("Artiest, album of nummer")}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setKeyboard(true)}
                />
                {query && (
                  <button
                    aria-label={tr("Wis zoekopdracht")}
                    onClick={() => setQuery("")}
                  >
                    <Icon name="close" size={16} />
                  </button>
                )}
              </label>}
              <small>{tr("ZOEKEN IN VOORBEELDMUZIEK")}</small>
              <div className="m2-list">
                {sample.length ? (
                  sample.map((t) => (
                    <button key={t.id} disabled={pending} onClick={() => {command({type:'queue-select',id:t.id});go('playing');}}>
                      <strong>{t.title}</strong>
                      <span>{t.artist}</span>
                      <small>›</small>
                    </button>
                  ))
                ) : (
                  <p>{tr("Geen resultaten voor “")}{tr(query)}{tr("”. Probeer Tycho.")}</p>
                )}
              </div>
            </div>
            {!wall&&<div className="m2-keyboard" aria-label={tr("Schermtoetsenbord")}>
              {keyboard ? (
                <>
                  <div className="m2-keyboard-title">{tr("Zoeken zonder telefoon")}<button onClick={() => setKeyboard(false)}>{tr("Verberg")}</button>
                  </div>
                  {["qwertyuiop", "asdfghjkl", "zxcvbnm"].map((row) => (
                    <div key={row}>
                      {[...row].map((k) => (
                        <button
                          aria-label={tr(`Toets ${k}`)}
                          key={k}
                          onClick={() => setQuery((q) => q + k)}
                        >
                          {tr(k)}
                        </button>
                      ))}
                    </div>
                  ))}
                  <div>
                    <button
                      className="m2-space"
                      onClick={() => setQuery((q) => q + " ")}
                    >{tr("Spatie")}</button>
                    <button
                      aria-label={tr("Backspace")}
                      onClick={() => setQuery((q) => q.slice(0, -1))}
                    >
                      <Icon name="backspace" />
                    </button>
                    <button onClick={() => setKeyboard(false)}>{tr("Gereed")}</button>
                  </div>
                </>
              ) : (
                <button onClick={() => setKeyboard(true)}>{tr("Toon toetsenbord")}</button>
              )}
            </div>}
          </div>
        ) : page === "queue" ? (
          <div className="m2-queue">
            <div className="m2-section-label">
              {tr(playback.queue.length)}{tr(" nummers")}{tr(" ")}
              <span>
                {tr(simulated
                  ? "Gedeelde simulatorwachtrij"
                  : "Music Assistant queue")}
              </span>
            </div>
            <div className="m2-list">
              {(wall?playback.queue:playback.queue.slice(offset, offset + 3)).map((t, i) => (
                <div className="m2-queue-row" key={t.id} data-current={(wall?i:offset+i)===playback.index}>
                  <span>
                    {tr(offset + i === playback.index
                      ? "▶"
                      : String(offset + i + 1).padStart(2, "0"))}
                  </span>
                  <button
                    disabled={!control || pending || t.id==='none'} aria-busy={pendingAction==='queue-select'}
                    onClick={async() => {await command({ type: "queue-select", id: t.id });}}
                  >
                    <strong>{t.title}</strong>
                    <small>{t.artist}</small>
                  </button>
                  <span>{tr(duration(t.duration))}</span>
                  <button
                    aria-label={translateFormat('Remove {name}',{name:t.title})}
                    disabled={
                      !control ||
                      (wall?i:offset+i) === playback.index ||
                      pending
                    }
                    onClick={() => command({ type: "queue-remove", id: t.id })}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ))}
            </div>
            {!wall&&<div className="m2-pagination">
              <button
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 3))}
              >{tr("‹ Vorige")}</button>
              <span>
                {tr(Math.floor(offset / 3) + 1)} /{tr(" ")}
                {tr(Math.ceil(playback.queue.length / 3))}
              </span>
              <button
                disabled={offset + 3 >= playback.queue.length}
                onClick={() => setOffset(offset + 3)}
              >{tr("Volgende ›")}</button>
            </div>}
          </div>
        ) : page === "rooms" ? (
          <Rooms offline={offline} controlToken={deviceUpdates?.info?.controlToken} onSnapshot={setSnapshot} onSetup={()=>{setSettingsPage(13);go('settings');}}/>
        ) : page === "settings" ? (
          <div className="m2-settings">
            <SettingsPages
              onClose={()=>navigate(()=>{setPage('playing');setDetail(null);setMessage('');})}
              onReplayStartup={onReplayStartup}
              offline={offline}
              initialPage={settingsPage}
              onPageChange={setSettingsPage}
              snapshot={snapshot}
              onSnapshot={setSnapshot}
              prefs={prefs}
              update={update}
              themePreferences={themePreferences}
              theme={theme}
              setThemePreferences={setThemePreferences}
            />
          </div>
        ) : (
          bluetoothActive?<div className="bluetooth-playing"><Icon name="bluetooth" size={90}/><div><h2>{playback.queue[0].title}</h2><p>{playback.queue[0].artist}</p><p>{tr('Choose music on your phone. TuneBox controls the local amplifier volume.')}</p><button onClick={()=>{setSettingsPage(13);go('settings');}}>{tr('Bluetooth settings')}</button></div></div>:<div className="m2-playing" data-visualizer={!video&&prefs.visualizer!=="off"}>
            {simulated ? (
              <Cover index={playback.index} />
            ) : (
              <Artwork src={shown.artwork} alt={shown.title} loading={skipLoading} />
            )}
            <div className="m2-track">
              <small>
                {tr(simulated ? "SIMULATIE" : "MUSIC ASSISTANT")} /{tr(" ")}
                {tr(playback.playerName || "TuneBox")}
              </small>
              <h2 title={shown.title}>{shown.title}</h2>
              <p>
                {shown.artist} <span>— {shown.album}</span>
              </p>
              <PlaybackSeekControl playback={playback} duration={current.duration} disabled={!control||!current.duration||prefs.seekEnabled===false||(!simulated&&!['seek','queue_seek'].some(c=>playback.capabilities?.includes(c)))} onSeek={value=>command({type:'seek',position:value})}/>
            </div>
            <aside>
              <div className="m2-artwork-controls"><button
                disabled={prefs.lowPower}
                aria-pressed={video}
                onClick={() => update('artwork',video?'cover':'video')}
              >
                <Icon name="film" size={16} />{tr(" ")}
                {tr(prefs.lowPower ? "Video uit · Pi 3 modus" : "Video Artwork")}
              </button>
              <button aria-label={tr("Switch visualizer")} onClick={toggleVisualizer}>{tr("Visualizer ")}{tr(prefs.visualizer==="off"?"uit":prefs.visualizer==="meters"?"meters":"spectrum")}</button></div>
              {video ? (
                <div className="m2-video">
                  <VideoArtwork snapshot={snapshot} prefs={prefs} offline={offline} onConfigure={()=>{setSettingsPage(16);go('settings');}}/>
                </div>
              ) : prefs.visualizer!=="off" ? (
                <AudioVisualizer timing={prefs.timing} timeline={playback} mode={prefs.visualizer} bands={prefs.visualizerBands} offline={offline} awake={device.displayAwake!==false&&!sleeping} paused={!playback.playing}/>
              ) : wall ? null : (
                <SkinPanel
                  skin={
                    presets.some((p) => p.id === theme.id)
                      ? theme.id
                      : "reference-dark"
                  }
                  theme={theme}
                  snapshot={snapshot}
                  offline={offline}
                />
              )}
            </aside>
            {wall&&<NowPlayingWidgets snapshot={snapshot} prefs={prefs} offline={offline} onOpen={target=>{if(target==='remote'){setParty(true);return;}if(target==='queue'||target==='rooms')go(target);else{const section=settingsSections.find(s=>s[0]===(target==='remote'?'connections':target));if(section){setSettingsPage(section[3]);go('settings');}}}}/>}
          </div>
        )}
      </section>
      {party&&<PartySheet snapshot={snapshot} onClose={()=>setParty(false)} onRooms={()=>go('rooms')}/>}
      <BluetoothPairing state={snapshot.bluetooth}/>
      {snapshot.playerBlocked&&page!=='settings'&&<div className="player-blocked" role="alert"><div><strong>{tr('Local player stopped: automatic power setup is blocked')}</strong><span>{tr('Last attempt')}: {tr(snapshot.playerBlocked.reason)}</span><span>{tr('Repair power setup, or turn off “Keep these settings after restart”, in Sensors.')}</span></div><button onClick={()=>{setSettingsPage(17);go('settings');}}>{tr('Open Sensors')}</button></div>}
      {page!=='settings'&&<LocalControl snapshot={snapshot} token={deviceUpdates?.info?.controlToken}/>}
      <footer className="m2-player">
        {!(wall&&page==='playing')&&(
        <button
          className="m2-current"
          onClick={page==='playing'?undefined:() => go("playing")}
          disabled={page==='playing'}
          aria-label={tr("Open Nu spelen")}
        >
          <span className="m2-current-cover" key={shown.id}>
            {simulated ? (
              <Cover index={playback.index} small />
            ) : (
              <Artwork src={shown.artwork} alt={shown.title} loading={skipLoading} />
            )}
          </span>
          <span>
            {page!=='playing'&&<span className="m2-return"><Icon name="back" size={20}/>{tr('Now Playing')}</span>}
            <strong>{shown.title}</strong>
            <small>{shown.artist}</small>
          </span>
        </button>
        )}
        <div className="m2-transport">
          <button
            aria-label={tr("Vorig nummer")} aria-busy={pendingAction==='previous'}
            disabled={bluetoothActive || !control || pending}
            onClick={() => command({ type: "previous" })}
          >
            <Icon name="previous" />
          </button>
          <button
            className="m2-play"
            aria-label={tr(playback.playing ? "Pauze" : "Afspelen")} aria-busy={['play','pause'].includes(pendingAction)}
            disabled={bluetoothActive || !control || pending}
            onClick={() =>
              command({ type: playback.playing ? "pause" : "play" })
            }
          >
            <Icon name={playback.playing ? "pause" : "play"} />
          </button>
          <button
            aria-label={tr("Volgend nummer")} aria-busy={pendingAction==='next'}
            disabled={bluetoothActive || !control || pending}
            onClick={() => command({ type: "next" })}
          >
            <Icon name="next" />
          </button>
        </div>
        <div
          className="m2-player-status"
          role="status"
          data-feedback={
            offline || notice || device.faults.length
              ? "attention"
              : pending
                ? "pending"
                : "idle"
          }
        >
          {tr(message ||
              notice ||
              (offline
                ? "Geen verbinding"
                : device.faults.length
                  ? "Apparaatfout · fysieke versterker uit"
                  : simulated
                    ? "SIMULATIE · GEEN AUDIO"
                    : ""))}
        </div>
        <button
          className="m2-mute"
          aria-label={tr(muted ? "Geluid aan" : "Dempen")}
          aria-pressed={!!muted}
          disabled={
            !control ||
            pending ||
            (!simulated && !["volume_mute","volume_mute_soft"].some(c=>playback.capabilities?.includes(c)))
          }
          onClick={() => command({ type: "mute", value: !muted })}
        >
          <Icon name={muted ? "mute" : "volume"} />
        </button>
        <TouchVolume
          value={volume}
          muted={muted}
          target={volumeRequests.target}
          onValue={volumeRequests.request}
          disabled={!canVolume}
          limit={bluetoothActive?Math.min(bluetooth.limit,controlVolumeLimit(snapshot)):controlVolumeLimit(snapshot)}
          mode={wall&&page==='playing'?'linear':prefs.volumeControl}
          step={wall&&page==='playing'?5:1}
          sensitivity={snapshot.preferences?.speakers?.sensitivity}
        />
      </footer>
    </main>
  );
}
