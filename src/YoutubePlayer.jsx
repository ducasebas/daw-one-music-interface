import React, {useEffect, useRef, useState} from 'react';
import {tr} from '../shared/i18n.js';
import {positionAt} from '../shared/playback.js';
import {localVideoSync} from '../shared/video.js';
import {playbackDiscontinuity, presentationTiming} from '../shared/presentation-timing.js';
import {youtubeAdjustment} from '../shared/youtube.js';
import './youtube.css';

let apiPromise;
export function loadYoutubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady, script = document.createElement('script');
    let finished = false;
    const finish = error => {
      if (finished) return; finished = true; clearTimeout(timeout);
      if (window.onYouTubeIframeAPIReady === ready) window.onYouTubeIframeAPIReady = previous;
      if (error) {script.remove(); reject(error);} else resolve(window.YT);
    };
    const ready = () => {try {previous?.();} finally {finish(window.YT?.Player ? null : Error('YouTube player unavailable'));}};
    const timeout = setTimeout(() => finish(Error('YouTube player timed out')), 12000);
    window.onYouTubeIframeAPIReady = ready;
    script.src = 'https://www.youtube.com/iframe_api'; script.async = true;
    script.referrerPolicy = 'strict-origin-when-cross-origin';
    script.onerror = () => finish(Error('YouTube player unavailable'));
    document.head.append(script);
  }).catch(error => {apiPromise = null; throw error;});
  return apiPromise;
}

const errorMessages = {
  2: 'The YouTube video link is invalid.',
  5: 'This browser could not decode the YouTube video.',
  100: 'This YouTube video is private or no longer available.',
  101: 'The video owner does not allow embedded playback.',
  150: 'The video owner does not allow embedded playback.',
  153: 'YouTube could not identify this player. Check its referrer settings.',
};

/** The official player stays intact. No stream extraction or audio routing.
 * Only this component reads the clock; the shell does not rerender each tick. */
export function YoutubePlayer({snapshot, prefs, link, offline = false, onStatus}) {
  const host = useRef(null), latest = useRef(null), stateCallback = useRef(onStatus), start = useRef(null);
  const [state, setState] = useState('loading'), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  latest.current = {snapshot, prefs, link, offline}; stateCallback.current = onStatus;
  useEffect(() => {stateCallback.current?.(state);}, [state]);
  useEffect(() => {
    let alive = true, ready = false, player, timer, readyTimer, failed = false, forced = true, blocked = false, visible = false, lastSeek = -Infinity, lastPlay = -Infinity, previous = null;
    const status = value => {if (alive) setState(old => old === value ? old : value);};
    const silence = () => {player.mute(); if (player.getVolume?.() !== 0) player.setVolume(0);};
    const destroy = () => {clearInterval(timer); clearTimeout(readyTimer); try {player?.stopVideo?.();} catch {} try {player?.destroy?.();} catch {} host.current?.replaceChildren();};
    const fail = message => {if (!alive || failed) return; failed = true; destroy(); setError(message); status('unavailable');};
    const tick = () => {
      if (!alive || failed || !player || !ready) return;
      try {
        silence();
        const v = latest.current, playback = v.snapshot.playback, track = playback?.queue?.[playback.index];
        if (!playback || v.offline || document.hidden || !visible || v.snapshot.device.displayAwake === false) {
          player.pauseVideo(); forced = true; status(v.offline ? 'offline' : 'paused'); return;
        }
        const point = {key: track?.mediaKey + '|' + track?.id + '|' + playback.playerId, position: playback.position, observedAt: playback.observedAt, playing: playback.playing};
        if (playbackDiscontinuity(previous, point)) forced = true; previous = point;
        if(!Number.isFinite(track?.duration)||track.duration<=0){player.pauseVideo();status('unavailable');return;}
        const duration = player.getDuration(), current = player.getCurrentTime();
        const now = performance.now();
        // YouTube may not expose duration until the first muted playback. Do
        // not wait for metadata before starting that playback or deadlock a cue.
        if (!Number.isFinite(duration) || duration <= 0) {
          if(!playback.playing)player.pauseVideo();
          else if(!blocked&&player.getPlayerState()!==3&&now-lastPlay>=2000){silence();player.playVideo();lastPlay=now;}
          status(!playback.playing?'paused':blocked?'tap-to-play':'buffering');return;
        }
        const sync = localVideoSync({audioPosition: positionAt(playback, Date.now()), audioDuration: track?.duration, videoDuration: duration, ...(v.link.sync || {mode: 'starts', offsetSeconds: 0}), screenDelayMs: presentationTiming(v.prefs.timing).screenDelayMs, playing: playback.playing});
        if (sync.status === 'fallback') {player.pauseVideo(); status('unavailable'); return;}
        if (youtubeAdjustment({target: sync.position, current, now, lastSeek, force: forced})) {
          player.seekTo(sync.position, true); lastSeek = now; forced = false;
        }
        if (host.current) host.current.dataset.driftMs = String(Math.round((sync.position - current) * 1000));
        const playingState = player.getPlayerState();
        if (!sync.playing) player.pauseVideo();
        else if (!blocked && ![1, 3].includes(playingState) && now - lastPlay >= 2000) {silence(); player.playVideo(); lastPlay = now;}
        status(sync.status === 'waiting' ? 'waiting' : sync.status === 'ended' ? 'ended' : !sync.playing ? 'paused' : blocked ? 'tap-to-play' : playingState === 1 ? 'playing' : 'buffering');
      } catch {fail('YouTube playback stopped responding. Your music keeps playing.');}
    };
    const view=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting&&entries[0].intersectionRatio>=.5;tick();},{threshold:[0,.5,1]});
    if(host.current)view.observe(host.current);
    setError(''); status(offline ? 'offline' : 'loading');
    if (!offline) loadYoutubeApi().then(YT => {
      if (!alive) return;
      const iframe = document.createElement('iframe'), url = new URL('https://www.youtube-nocookie.com/embed/' + link.videoId);
      url.search = new URLSearchParams({enablejsapi: '1', origin: location.origin, autoplay: '0', mute: '1', controls: '0', disablekb: '1', playsinline: '1', fs: '0'}).toString();
      iframe.title = tr('YouTube music video'); iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      // Keep a native frame-loading/error page out of the appliance. Reveal
      // only after the official player is ready; timeouts use our own fallback.
      iframe.style.opacity='0';iframe.style.pointerEvents='none';
      iframe.allow = 'autoplay; encrypted-media'; iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
      iframe.src = url.href; host.current?.append(iframe);
      readyTimer = setTimeout(() => fail('YouTube did not respond. Check the internet connection and retry.'), 15000);
      player = new YT.Player(iframe, {events: {
        onReady: () => {if (!alive || failed) return;ready=true;iframe.style.opacity='1';iframe.style.pointerEvents='auto';clearTimeout(readyTimer); silence(); start.current=()=>{if(alive&&!failed){blocked=false;silence();player.playVideo();}};tick(); timer = setInterval(tick, 250);},
        onStateChange: event => {if(event.data===1)blocked=false;if (alive && !failed) tick();},
        onAutoplayBlocked: () => {blocked=true;status('tap-to-play');},
        onError: event => fail(errorMessages[event.data] || 'YouTube could not play this video. Your music keeps playing.'),
      }});
    }).catch(() => fail('YouTube could not load. Check the internet connection and retry.'));
    document.addEventListener('visibilitychange', tick);
    return () => {alive = false;start.current=null;view.disconnect();document.removeEventListener('visibilitychange', tick); destroy();};
  }, [link.videoId, attempt, offline]);
  return <div className="youtube-player" data-player-state={state}>
    <div ref={host} className="youtube-frame"/>
    {error && <div className="youtube-error"><strong>{tr('YouTube video unavailable')}</strong><p role="status">{tr(error)}</p><button disabled={offline} onClick={() => setAttempt(v => v + 1)}>{tr('Retry video')}</button></div>}
    {!error && state === 'loading' && <p role="status"><span className="ui-spinner"/>{tr('Loading YouTube video…')}</p>}
    {state==='tap-to-play'&&<button onClick={()=>start.current?.()}>{tr('Start silent video')}</button>}
  </div>;
}
