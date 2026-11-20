import {tr,getLanguage,translateFormat} from "../shared/i18n.js";
import {searchTerm,searchTooShort,searchMinimum,searchDebounceMs,createSearchCache,searchCacheKey} from "../shared/search-suggest.js";
import React, { useState, useEffect, useRef } from "react";
import { Artwork } from "./Artwork.jsx";
import { Icon } from "./Icon.jsx";
import {KeyboardField} from "./TouchKeyboard.jsx";
import {Modal} from "./Modal.jsx";
import {panelProfile} from "../shared/display.js";
import {useDeviceUpdates} from './DeviceUpdates.jsx';
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
  const device=useDeviceUpdates();
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
    [message, setMessage] = useState(""),[pendingId,setPendingId]=useState(null),[replaceChoice,setReplaceChoice]=useState(null),[keyboardCycle,setKeyboardCycle]=useState(0);
  const mounted = useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const generation = useRef(0),
    lock = useRef(false),
    searchCache = useRef(null),
    seenRefresh = useRef(state.refresh);
  if (!searchCache.current) searchCache.current = createSearchCache();
  const change = (patch) => onState({ ...state, ...patch });
  const available = !offline && snapshot.musicAssistant?.connected;
  const controls =
    available &&
    snapshot.musicAssistant?.controlEnabled &&
    snapshot.playback.connected;
  const searching = view === "search" && !parent;
  const term = view === "search" ? searchTerm(q) : "";
  useEffect(() => {
    const id = ++generation.current,
      abort = new AbortController();
    setError("");
    if (!available) {
      setResult({ items: [], hasMore: false });
      setLoading(false);
      setError(
        "Music Assistant niet verbonden · probeer opnieuw zodra de verbinding terug is",
      );
      return () => abort.abort();
    }
    const key = parent ? null : searchCacheKey({ term, kind, offset, source, favorite });
    const retry = state.refresh !== seenRefresh.current;
    seenRefresh.current = state.refresh;
    const cached = key && !retry ? searchCache.current.get(key) : undefined;
    if (cached) {
      // A prefix seen moments ago answers at once, without another request.
      setResult(cached);
      setLoading(false);
      return () => abort.abort();
    }
    setLoading(true);
    // While typing, keep the previous suggestions until the new ones arrive.
    if (!searching) setResult({ items: [], hasMore: false });
    const timer = setTimeout(
      async () => {
        try {
          const params = new URLSearchParams({
            type: kind,
            offset: String(offset),
          });
          if (term) params.set("q", term);
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
          if (key) searchCache.current.set(key, data);
          if (id === generation.current) setResult(data);
        } catch (e) {
          if (e.name !== "AbortError" && id === generation.current) {
            setResult({ items: [], hasMore: false });
            setError(
              "Muziek laden mislukt · controleer server, bron of rechten",
            );
          }
        } finally {
          if (id === generation.current) setLoading(false);
        }
      },
      searching ? searchDebounceMs : 0,
    );
    return () => {
      // A newer keystroke cancels the pending timer and any request still in flight.
      clearTimeout(timer);
      abort.abort();
    };
  }, [view, kind, term, offset, parent?.id, favorite, source, available, state.refresh]);
  async function play(item, option, {confirmReplace = false} = {}) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);setPendingId(item.id);
    setMessage("");
    try {
      const r = await fetch("/api/library/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, option, ...(confirmReplace ? {confirmReplace: true} : {}) }),
      });
      const data = await r.json();
      // Music is waiting in the queue: ask before throwing it away.
      if (r.status === 409 && data.code === "queue-not-empty") {
        if (mounted.current) setReplaceChoice({item, upcoming: data.upcoming || 0});
        return;
      }
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
  async function choose(how) {
    const choice = replaceChoice;
    if (!choice || lock.current) return;
    if (how === "cancel") { setReplaceChoice(null); return; }
    if (how === "save") {
      setReplaceChoice({...choice, saving: true, error: ""});
      try {
        const r = await fetch("/api/library/save-queue", {method: "POST", headers: {"Content-Type": "application/json"}, body: "{}"});
        const data = await r.json();
        if (!r.ok) throw Error(data.error || "The queue could not be saved. Nothing was replaced.");
        setReplaceChoice(null);
        await play(choice.item, "replace", {confirmReplace: true});
        // Starting playback opens Now Playing, so announce the saved playlist in the player bar.
        window.dispatchEvent(new CustomEvent("tunebox-notice", {detail: translateFormat("Saved the queue as “{name}” ({count} tracks)", {name: data.name, count: data.saved})}));
      } catch (e) {
        if (mounted.current) setReplaceChoice({...choice, saving: false, error: e.message});
      }
      return;
    }
    setReplaceChoice(null);
    await play(choice.item, how === "replace" ? "replace" : how, {confirmReplace: how === "replace"});
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
  async function favoriteItem(item){
    if(lock.current)return;lock.current=true;setPending(true);setPendingId(item.id);setMessage('');
    try{
      const r=await fetch('/api/library/favorite',{method:'POST',headers:{'Content-Type':'application/json','X-TuneBox-Control':device?.info?.controlToken||''},body:JSON.stringify({id:item.id,enabled:!item.favorite}),signal:AbortSignal.timeout(15000)}),v=await r.json();
      if(!r.ok)throw Error(v.error);if(mounted.current){setMessage(item.favorite?'Removed from favorites':'Added to favorites');change({refresh:Date.now()});}
    }catch(e){if(mounted.current)setMessage(e.message||'Could not update favorite');}finally{lock.current=false;setPending(false);setPendingId(null);}
  }
  const body = (
    <>
      {!controls&&available&&<div className="music-connection-hint" role="status"><span>{tr(snapshot.musicAssistant?.controlEnabled?'Choose your TuneBox player to start listening.':'Playback control is off. Enable it in Connections.')}</span>{onConfigure&&<button onClick={onConfigure}>{tr('Connections')}</button>}</div>}
      <div className="live-library-bar"><label className="library-source">{tr('Source')}<select aria-label={tr('Music source')} value={source} onChange={e=>change({source:e.target.value,offset:0,parent:null,trail:[]})}><option value="all">{tr('All sources')}</option><option value="local">{tr('Local files')}</option><option value="spotify">Spotify</option><option value="tidal">Tidal</option><option value="ytmusic">YouTube Music</option><option value="qobuz">Qobuz</option><option value="deezer">Deezer</option><option value="apple_music">Apple Music</option></select></label>
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
          touch ? <div className="live-search-field"><KeyboardField key={keyboardCycle} label="Search music" value={q} onChange={value=>change({q:value,offset:0})} maxLength={120} autoOpen suggestions={term?result.items:[]} suggestionsLoading={loading&&!!term} suggestionsMinimum={searchMinimum} onSuggestion={item=>["artist","album","playlist"].includes(item.type)?open(item):play(item,"replace")}/><button onClick={()=>{change({q:'',offset:0});setKeyboardCycle(v=>v+1);}}>{tr('New search')}</button></div> : <label className="live-search-input">
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
        {searching && searchTooShort(q) && <p className="live-search-hint" role="status">{tr("Type at least 3 characters")}</p>}
        {loading && !result.items.length ? (
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
                  <button aria-label={translateFormat(item.favorite?'Remove {name} from favorites':'Add {name} to favorites',{name:item.name})} aria-pressed={item.favorite} disabled={!available||!snapshot.musicAssistant?.controlEnabled||pending} onClick={()=>favoriteItem(item)}><span aria-hidden="true">{item.favorite?'♥':'♡'}</span></button>
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
      {replaceChoice&&<Modal label="Music is waiting in the queue" onCancel={()=>choose('cancel')} className="queue-choice">
        <h3>{tr('Music is waiting in the queue')}</h3>
        <p>{translateFormat(replaceChoice.upcoming===1?'{count} track is queued after the current one. Someone may have added it.':'{count} tracks are queued after the current one. Someone may have added them.',{count:replaceChoice.upcoming})}</p>
        <p className="queue-choice-item"><strong>{replaceChoice.item.name}</strong>{replaceChoice.item.artist?<span> · {replaceChoice.item.artist}</span>:null}</p>
        <div className="queue-choice-actions">
          <h4>{tr('Play it now')}</h4>
          <button disabled={replaceChoice.saving} className="queue-choice-recommended" onClick={()=>choose('save')}><Icon name="library" size={30}/><span><strong>{tr(replaceChoice.saving?'Saving playlist…':'Save the queue as a playlist, then play')}</strong><small>{tr('Recommended · the waiting tracks stay in Music Assistant')}</small></span><b aria-hidden="true">›</b></button>
          <button disabled={replaceChoice.saving} className="queue-choice-replace" onClick={()=>choose('replace')}><Icon name="play" size={30}/><span><strong>{tr('Replace the queue and play')}</strong><small>{tr('The waiting tracks are removed')}</small></span><b aria-hidden="true">›</b></button>
          <h4>{tr('Keep the queue')}</h4>
          <button disabled={replaceChoice.saving} onClick={()=>choose('next')}><Icon name="next" size={30}/><span><strong>{tr('Play next')}</strong><small>{tr('After the current track; the queue stays')}</small></span><b aria-hidden="true">›</b></button>
          <button disabled={replaceChoice.saving} onClick={()=>choose('add')}><Icon name="queue" size={30}/><span><strong>{tr('Add to the end')}</strong><small>{tr('The queue stays as it is')}</small></span><b aria-hidden="true">›</b></button>
        </div>
        {replaceChoice.error&&<p role="alert">{tr(replaceChoice.error)}</p>}
        <button className="queue-choice-cancel" disabled={replaceChoice.saving} onClick={()=>choose('cancel')}>{tr('Cancel')}</button>
      </Modal>}
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
