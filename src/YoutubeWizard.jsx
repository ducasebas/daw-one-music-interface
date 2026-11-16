import React, {useEffect, useRef, useState} from 'react';
import {Modal} from './Modal.jsx';
import {Icon} from './Icon.jsx';
import {KeyboardField} from './TouchKeyboard.jsx';
import {QrCode} from './NetworkWizard.jsx';
import {useDeviceUpdates} from './DeviceUpdates.jsx';
import {VideoPreview} from './VideoArtwork.jsx';
import {youtubeVideoId} from '../shared/youtube.js';
import {tr} from '../shared/i18n.js';
import './youtube.css';

const steps = ['Account', 'Player', 'Video', 'Timing', 'Ready'];
const help = 'https://www.music-assistant.io/music-providers/youtube-music/';
const problems = {
  'premium-required': 'Music Assistant reports that this account needs YouTube Music Premium.',
  'account-expired': 'The YouTube Music login has expired. Reconnect this source in Music Assistant.',
  'token-server-unavailable': 'Music Assistant cannot reach its YouTube Music PO Token server.',
  'source-unavailable': 'This source is not ready. Open its settings in Music Assistant.',
};
export default function YoutubeWizard({snapshot, prefs, update, offline = false, onClose, onChanged}) {
  const device = useDeviceUpdates(), mounted = useRef(true), busyRef = useRef(false), baseRef = useRef(null), requests = useRef(new Set());
  const [step, setStep] = useState(0), [status, setStatus] = useState(null), [base, setBase] = useState(null), [draft, setDraft] = useState(null);
  const [link, setLink] = useState(null), [offset, setOffset] = useState(0), [mode, setMode] = useState('starts'), [video, setVideo] = useState('');
  const [pending, setPending] = useState(''), [notice, setNotice] = useState(''), [leave, setLeave] = useState(false), [showHandoff, setShowHandoff] = useState(false);
  const body=useRef(null),[more,setMore]=useState(false);
  const track = snapshot.playback?.queue?.[snapshot.playback.index], trackIdentity = track?.mediaKey || track?.id;
  const [player, setPlayer] = useState(snapshot.playback?.playerId || '');
  const chosen = status?.sources.find(v => v.id === draft?.providerId) || (status?.sources.length === 1 ? status.sources[0] : null);
  const timingDirty = link?.available && (offset !== (link.sync?.offsetSeconds || 0) || mode !== (link.sync?.mode || 'starts'));
  const dirty = !!base && JSON.stringify(base) !== JSON.stringify(draft) || !!video || timingDirty;
  const usable = !offline && !!device.info?.controlToken && !pending;
  useEffect(() => {mounted.current = true; return () => {mounted.current = false; for (const c of requests.current) c.abort();};}, []);
  useEffect(()=>{
    const node=body.current;if(!node)return;
    const check=()=>setMore(node.scrollHeight-node.scrollTop-node.clientHeight>24);
    const observer=new ResizeObserver(check);observer.observe(node);for(const child of node.children)observer.observe(child);node.addEventListener('scroll',check,{passive:true});check();
    return()=>{observer.disconnect();node.removeEventListener('scroll',check);};
  },[step,status,showHandoff,link]);
  async function api(path, body) {
    const controller = new AbortController(); requests.current.add(controller);
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const r = await fetch(path, {method: body === undefined ? 'GET' : 'POST', cache: 'no-store', signal: controller.signal, headers: body === undefined ? {} : {'Content-Type': 'application/json', 'X-TuneBox-Control': device.info?.controlToken || ''}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
      const value = await r.json(); if (!r.ok) throw Error(value.error || 'YouTube setup could not continue'); return value;
    } finally {clearTimeout(timer); requests.current.delete(controller);}
  }
  async function run(label, action) {
    if (busyRef.current) return false; busyRef.current = true; setPending(label); setNotice('');
    try {await action(); return true;} catch (e) {if (mounted.current) setNotice(e.name === 'AbortError' ? 'The connection timed out. Try again.' : e.message); return false;}
    finally {busyRef.current = false; if (mounted.current) setPending('');}
  }
  async function refresh(reset = false) {
    const value = await api('/api/youtube/status'); if (!mounted.current) return;
    setStatus(value);
    if (!baseRef.current || reset) {baseRef.current = value.settings; setBase(value.settings); setDraft(value.settings);}
  }
  function acceptLink(value) {setLink(value); setOffset(value.sync?.offsetSeconds || 0); setMode(value.sync?.mode || 'starts');}
  useEffect(() => {run('Checking account…', () => refresh());}, []);
  useEffect(() => {
    let active = true;
    setLink(null); setVideo('');
    api('/api/video').then(value => {if (active && mounted.current) acceptLink(value);}).catch(() => {if (active && mounted.current) setNotice('Video settings could not be loaded. Reconnect and try again.');});
    return () => {active = false;};
  }, [trackIdentity, snapshot.youtube?.revision, snapshot.videoRevision]);
  useEffect(() => {
    if (step !== 0 || offline || !showHandoff) return;
    const timer = setInterval(() => {if (!document.hidden && !busyRef.current) run('Checking account…', () => refresh());}, 5000);
    return () => clearInterval(timer);
  }, [step, offline, showHandoff]);
  async function saveOptions() {
    if (!draft) throw Error('Wait for YouTube settings to load');
    if (JSON.stringify(draft) === JSON.stringify(baseRef.current)) return;
    const value = await api('/api/youtube/settings', draft); if (!mounted.current) return;
    baseRef.current = value; setBase(value); setDraft(value); onChanged?.();
  }
  async function next() {
    await run('Saving…', async () => {
      if (step === 0) await saveOptions();
      if (step === 1 && player !== snapshot.playback?.playerId) {
        if (!player) throw Error('Select an available player');
        await api('/api/player', {id: player});
      }
      if (step === 2) {
        await saveOptions();
        if (video) {const value = await api('/api/video/youtube', {trackKey: link?.trackKey, video}); if (mounted.current) {acceptLink(value); setVideo(''); onChanged?.();}}
      }
      if (step === 3 && timingDirty) {
        const value = await api('/api/video/timing', {trackKey: link.trackKey, id: link.id, revision: link.revision, sync: {mode, offsetSeconds: offset}});
        if (mounted.current) {acceptLink(value); onChanged?.();}
      }
      if (mounted.current) {setStep(v => Math.min(4, v + 1)); setNotice('Saved');}
    });
  }
  function close() {if (dirty) setLeave(true); else onClose();}
  function handoff(url) {window.dispatchEvent(new CustomEvent('tunebox:handoff', {detail: {url}, cancelable: true}));}
  const readyVideo = link?.available && link.source === 'youtube' && link.consent && base?.consent;
  return <>
    <Modal label="YouTube Music setup" onCancel={close} className="youtube-wizard">
      <header><div><small>DAW TuneBox</small><h2>YouTube Music</h2></div><button disabled={!!pending} onClick={close}><Icon name="close"/>{tr('Close')}</button></header>
      <nav aria-label={tr('YouTube setup steps')}>{steps.map((name, i) => <button key={name} disabled={!!pending || i > step} aria-current={i === step ? 'step' : undefined} onClick={() => {setStep(i); setNotice('');}}><b>{i + 1}</b>{tr(name)}</button>)}</nav>
      <div className="youtube-wizard-body" ref={body}>
        {step === 0 && <>
          <h3>{tr('Connect your YouTube Music library')}</h3>
          <p>{tr('Music Assistant owns your account connection, library and playlists. TuneBox does not ask for your Google password.')}</p>
          <p>{tr('YouTube Music requires Premium here. Music Assistant checks the account when loading the source; an unavailable source is never shown as connected.')}</p>
          {!status ? <p role="status">{tr(pending || 'Check the Music Assistant connection to continue.')}</p> : !status.connected ? <p role="status">{tr('Connect Music Assistant first. You can still set up a video link without a music account.')}</p> : <>
            {status.sources.length > 0 && <div className="youtube-accounts">{status.sources.map(source => <button key={source.id} aria-pressed={chosen?.id === source.id} onClick={() => setDraft(v => ({...v, providerId: source.id}))}><Icon name={source.available ? 'check' : 'alert'}/><span><strong>{source.name}</strong><small>{tr(source.available ? 'Account accepted by Music Assistant' : problems[source.issue] || 'Source is not ready')}</small></span></button>)}</div>}
            {status.sourceState === 'not-connected' && <p>{tr('No YouTube Music account is connected yet.')}</p>}
            {status.sourceState === 'unknown' && <p>{tr('Music Assistant did not grant access to source settings. Check its account permissions.')}</p>}
            <button onClick={() => setShowHandoff(v => !v)}>{tr('Connect or repair account')}</button>
            {showHandoff && <div className="youtube-handoff"><div><h4>{tr('Complete the account step in Music Assistant')}</h4><ol><li>{tr('Open Music Assistant on your computer.')}</li><li>{tr('Go to Settings → Music sources → YouTube Music.')}</li><li>{tr('Follow its login-cookie and PO Token instructions, then save.')}</li><li>{tr('Return here and check the account.')}</li></ol><p>{tr('The login cookie stays in Music Assistant. There is no Google OAuth login for the YouTube Music library.')}</p><button onClick={() => handoff(help)}>{tr('YouTube Music setup guide')}</button></div>{status.webUrl && <div><QrCode label="Open Music Assistant" value={status.webUrl}/><code>{status.webUrl}</code></div>}</div>}
          </>}
          <button disabled={offline || !!pending} onClick={() => run('Checking account…', () => refresh())}>{tr('Check account')}</button>
          <button disabled={offline || !!pending} onClick={() => run('Loading…', () => refresh(true))}>{tr('Reload saved setup')}</button>
        </>}
        {step === 1 && <>
          <h3>{tr('Choose the player to follow')}</h3><p>{tr('Video follows the selected Music Assistant player. Selecting a player sends no play, volume or grouping command.')}</p>
          <div className="youtube-player-choices">{snapshot.musicAssistant?.players?.map(p => <button key={p.id} disabled={!p.available || !!pending} aria-pressed={player === p.id} onClick={() => setPlayer(p.id)}><Icon name="speaker"/><span>{p.name}</span>{player === p.id && <Icon name="check"/>}</button>)}</div>
          {!snapshot.musicAssistant?.players?.length && <p>{tr('No player is available. Connect your player in Music Assistant, then reopen this step.')}</p>}
          <p>{tr('Your audio output and Squeezelite identity stay unchanged.')}</p>
        </>}
        {step === 2 && <>
          <h3>{tr('Choose the video')}</h3><p>{tr('YouTube handles the video in its embedded player. Music Assistant keeps the audio. Some music tracks only have a still image, and some videos cannot be embedded.')}</p>
          <label className="hub-check"><input type="checkbox" checked={draft?.consent || false} disabled={!draft || !!pending} onChange={e => setDraft(v => ({...v, consent: e.target.checked, followCurrent: e.target.checked && v.followCurrent}))}/>{tr('Allow YouTube video')}</label>
          <p>{tr('Loading video connects to YouTube and shares playback and device information with Google. Account linking does not sign the embedded player into Premium.')}</p>
          <button onClick={() => handoff('https://policies.google.com/privacy')}>{tr('Google Privacy Policy')}</button>
          <label className="hub-check"><input type="checkbox" checked={draft?.followCurrent || false} disabled={!draft?.consent || !!pending} onChange={e => setDraft(v => ({...v, followCurrent: e.target.checked}))}/>{tr('Follow YouTube Music tracks automatically')}</label>
          <p>{tr('This uses the exact YouTube ID supplied by Music Assistant. It never guesses another recording from the title.')}</p>
          <article className="video-track"><strong>{track?.title || tr('Select a track first')}</strong><span>{track?.artist}</span></article>
          <KeyboardField label="YouTube video link" value={video} maxLength={2048} onChange={setVideo} placeholder="https://www.youtube.com/watch?v=…" disabled={!!pending || !draft?.consent}/>
          <p>{tr('Leave the link empty to follow a YouTube Music track automatically, or enter a different video for this track only.')}</p>
          {video && !youtubeVideoId(video) && <p role="status">{tr('Enter a YouTube video link or video ID')}</p>}
        </>}
        {step === 3 && <>
          <h3>{tr('Match video timing')}</h3>
          {readyVideo ? <div className="youtube-timing-layout"><VideoPreview snapshot={snapshot} prefs={prefs} offline={offline} link={{...link, sync: {mode, offsetSeconds: offset}}}/><section className="youtube-timing-controls">
            <div className="hub-tabs">{[['starts', 'Match starts'], ['ends', 'Match ends']].map(([id, name]) => <button key={id} aria-pressed={mode === id} onClick={() => setMode(id)}>{tr(name)}</button>)}</div>
            <label>{tr('Video start correction (seconds)')}<input aria-label={tr('YouTube video correction')} type="number" min="-600" max="600" step="0.1" value={offset} onChange={e => setOffset(Math.max(-600, Math.min(600, Number(e.target.value) || 0)))}/></label>
            <div className="hub-tabs"><button onClick={() => setOffset(v => Math.max(-600, Math.round((v - .1) * 10) / 10))}>−0.1 s</button><button onClick={() => setOffset(v => Math.min(600, Math.round((v + .1) * 10) / 10))}>+0.1 s</button><button onClick={() => {setOffset(0); setMode('starts');}}>{tr('Reset video timing')}</button></div>
          </section></div> : <p>{tr('Play a YouTube Music track or link a video first. You can finish setup and adjust timing later.')}</p>}
          <p>{tr('Pause, seeking and track changes are followed automatically. Ads, buffering and different recordings can prevent exact sync. Shared screen delay also applies; this never changes the music clock.')}</p>
        </>}
        {step === 4 && <>
          <h3>{tr(readyVideo ? 'Ready to watch' : 'YouTube setup saved')}</h3>
          <dl className="youtube-summary"><div><dt>{tr('Account')}</dt><dd>{tr(chosen?.available ? 'Account accepted by Music Assistant' : 'Not connected')}</dd></div><div><dt>{tr('Player')}</dt><dd>{snapshot.musicAssistant?.players?.find(v => v.id === (player || snapshot.playback?.playerId))?.name || tr('Not selected')}</dd></div><div><dt>{tr('Video')}</dt><dd>{tr(link?.source === 'youtube' && link.available ? 'Linked to this track' : draft?.followCurrent ? 'Follows YouTube Music' : 'Choose a video later')}</dd></div></dl>
          <p>{tr('Find your library and playlists under My Music. Open Now Playing → Video Artwork for inline or full screen video.')}</p>
          <button disabled={!update || !base?.consent || !!dirty || !!pending} onClick={() => run('Saving…',async()=>{await update('artwork','video');if(mounted.current){onChanged?.();onClose();}})}>{tr('Enable Video Artwork')}</button>
          <button onClick={close}>{tr('Done')}</button>
        </>}
      </div>
      <footer><span role="status" aria-live="polite">{pending && <span className="ui-spinner"/>}{tr(pending || notice || (dirty?'Unsaved changes':''))}{more&&<small aria-hidden="true">↓ {tr('More below')}</small>}</span><button disabled={step === 0 || !!pending} onClick={() => setStep(v => v - 1)}>{tr('Back')}</button>{step < 4 && <><button disabled={!!pending} onClick={() => {setStep(v => v + 1); setNotice('');}}>{tr('Skip this step')}</button><button disabled={!usable || !draft || step === 0 && !chosen?.available || step === 2 && !!video && (!youtubeVideoId(video) || !draft.consent || !link?.trackKey || !Number.isFinite(track?.duration))} onClick={next}>{tr(step === 2 || step === 3 && timingDirty ? 'Save and continue' : 'Next')}</button></>}</footer>
    </Modal>
    {leave && <Modal label="Unsaved YouTube setup" onCancel={() => setLeave(false)}><h3>{tr('Discard unsaved changes?')}</h3><p>{tr('Saved account and video settings remain available.')}</p><button onClick={() => setLeave(false)}>{tr('Keep editing')}</button><button onClick={onClose}>{tr('Discard changes')}</button></Modal>}
  </>;
}
