import {tr} from "../shared/i18n.js";
import React, { useState, useEffect, useRef } from "react";
import { Artwork } from "./Artwork.jsx";
import { Icon } from "./Icon.jsx";
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
  state,
  onState,
}) {
  const {
    kind = "albums",
    q = "",
    offset = 0,
    parent = null,
    favorite = false,
    trail = [],
  } = state;
  const [result, setResult] = useState({ items: [], hasMore: false }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
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
  }, [view, kind, q, offset, parent?.id, favorite, available, state.refresh]);
  async function play(item, option) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setMessage("Verzoek versturen…");
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
      setPending(false);
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
      <div className="live-library-bar">
        {parent ? (
          <button
            aria-label={tr("Terug naar bibliotheek")}
            onClick={() => {
              const last = trail.at(-1) || { parent: null, offset: 0 };
              change({ ...last, trail: trail.slice(0, -1) });
            }}
          >
            ← {tr(parent.name)}
          </button>
        ) : view === "search" ? (
          <label className="live-search-input">
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
              <article key={item.id}>
                <button
                  className="live-media-open"
                  disabled={
                    !["artist", "album", "playlist"].includes(item.type) ||
                    pending
                  }
                  onClick={() => open(item)}
                  aria-label={tr(`Open ${item.name}`)}
                >
                  <Artwork src={item.artwork} alt={tr(item.name)} />
                  <span>
                    <b>{tr(item.name)}</b>
                    <small>
                      {tr(item.artist || item.type)}
                      {tr(item.favorite ? " · ♥" : "")}
                    </small>
                  </span>
                </button>
                <div className="live-media-actions">
                  {item.type !== "artist" && (
                    <>
                      <button
                        aria-label={tr(`Speel ${item.name}`)}
                        disabled={!controls || !item.available || pending}
                        onClick={() => play(item, "replace")}
                      >
                        <Icon name="play" size={14} />
                        <span>{tr("Speel")}</span>
                      </button>
                      <button
                        aria-label={tr(`Als volgende ${item.name}`)}
                        disabled={!controls || !item.available || pending}
                        onClick={() => play(item, "next")}
                      >{tr("Volgende")}</button>
                      <button
                        aria-label={tr(`Voeg toe ${item.name}`)}
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
          onClick={() => change({ offset: offset + 3 })}
        >{tr("Volgende →")}</button>
      </div>
    </>
  );
  return (
    <div
      className={`live-library ${view === "search" && !parent ? "with-keyboard" : ""}`}
      aria-label={tr("Music Assistant bibliotheek")}
    >
      <div className="live-library-main">{tr(body)}</div>
      {view === "search" && !parent && (
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
