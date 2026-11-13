import {tr,getLanguage,translateFormat} from "../shared/i18n.js";
import React, { useState, useEffect, useRef } from "react";
import { Artwork } from "./Artwork.jsx";
import { Icon } from "./Icon.jsx";
import {KeyboardField} from "./TouchKeyboard.jsx";
import {panelProfile} from "../shared/display.js";
const kinds = [
  ["albums", "Albums"],
  ["artists", "Artiesten"],
  ["tracks", "Nummers"],
  ["playlists", "Playlists"],
  ["radios", "Radio"],
];
export function LiveLibrary({
  view,
  snapshot,
  offline,
  onSnapshot,
  onPlaying,
  onConfigure,
  state,
  onState,
}) {
  const touch=panelProfile(location.search)==="wall-16-10";
  const {
    kind = "albums",
    q = "",
    offset = 0,
    parent = null,
    favorite = false,
    source = "all",
    trail = [],
  } = state;
  const [result, setResult] = useState({ items: [], hasMore: false }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),[pendingId,setPendingId]=useState(null),[keyboardCycle,setKeyboardCycle]=useState(0);
  const mounted = useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const generation = useRef(0),
    lock = useRef(false);
  const change = (patch) => onState({ ...state, ...patch });
  const available = !offline && snapshot.musicAssistant?.connected;
  const controls =
    available &&
    snapshot.musicAssistant?.controlEnabled &&
    snapshot.playback.connected;
  useEffect(() => {
    const id = ++generation.current,
      abort = new AbortController();
    setLoading(true);
    setError("");
    setResult({ items: [], hasMore: false });
    if (!available) {
      setLoading(false);
      setError(
        "Music Assistant niet verbonden · probeer opnieuw zodra de verbinding terug is",
      );
      return () => abort.abort();
    }
    const timer = setTimeout(
      async () => {
        try {
          const params = new URLSearchParams({
            type: kind,
            offset: String(offset),
          });
          if (view === "search") params.set("q", q);
          if (parent) params.set("parent", parent.id);
          if (favorite) params.set("favorite", "true");
          if(source!=="all")params.set("source",source);
          const r = await fetch(`/api/library?${params}`, {
            signal: abort.signal,
          });
          if (!r.ok) throw Error();
          const data = await r.json();
          if (!Array.isArray(data.items) || typeof data.hasMore !== "boolean")
            throw Error();
          if (id === generation.current) setResult(data);
        } catch (e) {
          if (e.name !== "AbortError" && id === generation.current)
            setError(
              "Muziek laden mislukt · controleer server, bron of rechten",
            );
        } finally {
          if (id === generation.current) setLoading(false);
        }
      },
      view === "search" ? 300 : 0,
    );
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [view, kind, q, offset, parent?.id, favorite, source, available, state.refresh]);
  async function play(item, option) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);setPendingId(item.id);
    setMessage("");
    try {
      const r = await fetch("/api/library/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, option }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Actie geweigerd");
      onSnapshot(data);
      setMessage(
        option === "replace"
          ? "Afspeelverzoek bevestigd"
          : "Aan wachtrij toegevoegd",
      );
      if (option === "replace" && mounted.current) onPlaying();
    } catch (e) {
      setMessage(e.message || "Actie mislukt; niet opnieuw verstuurd");
    } finally {
      lock.current = false;
      setPending(false);setPendingId(null);
    }
  }
  function open(item) {
    if (["artist", "album", "playlist"].includes(item.type)) {
      change({
        parent: item,
        offset: 0,
        trail: [...trail, { parent, offset }].slice(-6),
      });
      setMessage("");
    }
  }
  const body = (
    <>
      {!controls&&available&&<div className="music-connection-hint" role="status"><span>{tr(snapshot.musicAssistant?.controlEnabled?'Choose your TuneBox player to start listening.':'Playback control is off. Enable it in Connections.')}</span>{onConfigure&&<button onClick={onConfigure}>{tr('Connections')}</button>}</div>}
      <div className="live-library-bar"><label className="library-source">{tr('Source')}<select aria-label={tr('Music source')} value={source} onChange={e=>change({source:e.target.value,offset:0,parent:null,trail:[]})}><option value="all">{tr('All sources')}</option><option value="local">{tr('Local files')}</option><option value="spotify">Spotify</option><option value="tidal">Tidal</option></select></label>
        {parent ? (
          <button
            aria-label={tr("Terug naar bibliotheek")}
            onClick={() => {
              const last = trail.at(-1) || { parent: null, offset: 0 };
              change({ ...last, trail: trail.slice(0, -1) });
            }}
          >
            ← {parent.name}
          </button>
        ) : view === "search" ? (
          touch ? <div className="live-search-field"><KeyboardField key={keyboardCycle} label="Search music" value={q} onChange={value=>change({q:value,offset:0})} maxLength={120} autoOpen/><button onClick={()=>{change({q:'',offset:0});setKeyboardCycle(v=>v+1);}}>{tr('New search')}</button></div> : <label className="live-search-input">
            <Icon name="search" />
            <input
              aria-label={tr("Zoek echte muziek")}
              value={q}
              maxLength={120}
              onChange={(e) => change({ q: e.target.value, offset: 0 })}
              placeholder={tr("Zoek in Music Assistant")}
            />
          </label>
        ) : (
          <>
            {kinds.map(([id, label]) => (
              <button
                key={id}
                aria-pressed={kind === id}
                onClick={() => change({ kind: id, offset: 0, parent: null })}
              >
                {tr(label)}
              </button>
            ))}
            <label>
              <input
                aria-label={tr("Alleen favorieten")}
                type="checkbox"
                checked={favorite}
                onChange={(e) =>
                  change({ favorite: e.target.checked, offset: 0 })
                }
              />{tr(" ")}{tr("Favorieten")}</label>
          </>
        )}
      </div>
      <div className="live-library-results" aria-busy={loading}>
        {loading ? (
          <p role="status">{tr("Muziek laden…")}</p>
        ) : error ? (
          <div role="alert">
            {tr(error)}
            <button onClick={() => change({ offset, refresh: Date.now() })}>{tr("Opnieuw proberen")}</button>
          </div>
        ) : !result.items.length ? (
          <p>{tr("Geen muziek gevonden · controleer je bibliotheek en gekoppelde bronnen in Music Assistant")}</p>
        ) : (
          <div className="live-media-grid">
            {result.items.map((item) => (
              <article key={item.id} data-pending={pendingId===item.id}>
                <button
                  className="live-media-open"
                  disabled={pending || !["artist", "album", "playlist"].includes(item.type)&&(!controls||!item.available)}
                  aria-busy={pendingId===item.id}
                  onClick={() => ["artist", "album", "playlist"].includes(item.type)?open(item):play(item,"replace")}
                  aria-label={translateFormat(item.type==='track'?'Play track {name}':'Open {name}',{name:item.name})}
                >
                  <Artwork src={item.artwork} alt={item.name} />
                  <span>
                    <b>{item.name}</b>
                    <small>
                      {item.artist || tr(item.type)}
                      {item.releaseDate ? ` · ${new Date(item.releaseDate+'T00:00:00Z').toLocaleDateString(getLanguage()==='nl'?'nl-NL':'en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})}` : item.year ? ` · ${item.year}` : ''}{tr(item.favorite ? " · ♥" : "")}
                    </small>
                  </span>
                </button>
                <div className="live-media-actions">
                  {item.type !== "artist" && (
                    <>
                      <button
                        aria-label={translateFormat('Play {name}',{name:item.name})}
                        disabled={!controls || !item.available || pending}
                        onClick={() => play(item, "replace")}
                      >
                        <Icon name="play" size={14} />
                        <span>{tr("Speel")}</span>
                      </button>
                      <button
                        aria-label={translateFormat('Play next {name}',{name:item.name})}
                        disabled={!controls || !item.available || pending}
                        onClick={() => play(item, "next")}
                      >{tr("Volgende")}</button>
                      <button
                        aria-label={translateFormat('Add {name}',{name:item.name})}
                        disabled={!controls || !item.available || pending}
                        onClick={() => play(item, "add")}
                      >
                        ＋
                      </button>
                    </>
                  )}
                  {!item.available && <small>{tr("Niet beschikbaar")}</small>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <div className="live-library-footer">
        <button
          disabled={loading || offset === 0}
          onClick={() => change({ offset: Math.max(0, offset - 3) })}
        >{tr("← Vorige")}</button>
        <small role="status">
          {tr(message ||
            `${parent?.name || kinds.find((k) => k[0] === kind)?.[1] || "Muziek"} · pagina ${Math.floor(offset / 3) + 1}${!snapshot.musicAssistant?.controlEnabled ? " · alleen-lezen" : ""}`)}
        </small>
        <button
          disabled={loading || !result.hasMore}
          onClick={() => change({ offset: result.nextOffset ?? offset + 3 })}
        >{tr("Volgende →")}</button>
      </div>
    </>
  );
  return (
    <div
      className={`live-library ${view === "search" && !parent && !touch ? "with-keyboard" : ""}`}
      aria-label={tr("Music Assistant bibliotheek")}
    >
      <div className="live-library-main">{tr(body)}</div>
      {view === "search" && !parent && !touch && (
        <div className="live-keyboard" aria-label={tr("Zoektoetsenbord")}>
          {"qwertyuiopasdfghjklzxcvbnm".split("").map((k) => (
            <button
              key={k}
              aria-label={tr(`Zoektoets ${k}`)}
              onClick={() => change({ q: q + k, offset: 0 })}
            >
              {tr(k)}
            </button>
          ))}
          <button
            aria-label={tr("Zoekspatie")}
            onClick={() => change({ q: q + " ", offset: 0 })}
          >{tr("Spatie")}</button>
          <button
            aria-label={tr("Zoekwissen")}
            onClick={() => change({ q: q.slice(0, -1), offset: 0 })}
          >
            ⌫
          </button>
        </div>
      )}
    </div>
  );
}
