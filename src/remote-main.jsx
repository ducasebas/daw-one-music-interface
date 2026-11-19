import React,{useCallback,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Icon} from './Icon.jsx';
import './remote.css';

/*
 * Phone remote for one TuneBox. Deliberately small and separate from the wall app:
 * it only plays, pauses, skips, searches and changes volume through /api/remote/*.
 */
const words={
 nl:{'Opening TuneBox remote…':'Afstandsbediening openen…','Pairing with TuneBox…':'Koppelen met TuneBox…','Scan the QR code on TuneBox':'Scan de QR-code op TuneBox','On TuneBox, open Settings → Connections → Phone remote and choose Pair a phone.':'Open op TuneBox Instellingen → Verbindingen → Telefoon-afstandsbediening en kies Telefoon koppelen.','Your phone must be on the same Wi-Fi network as TuneBox.':'Je telefoon moet op hetzelfde wifi-netwerk zitten als TuneBox.','Paired with TuneBox':'Gekoppeld met TuneBox','Reconnecting to TuneBox…':'Opnieuw verbinden met TuneBox…','Nothing is playing':'Er speelt niets','Play':'Afspelen','Pause':'Pauzeren','Previous':'Vorige','Next':'Volgende','Volume down':'Zachter','Volume up':'Harder','Mute':'Dempen','Unmute':'Dempen opheffen','Volume':'Volume','limit':'limiet','Search music':'Muziek zoeken','Song, artist, album or playlist':'Nummer, artiest, album of playlist','Search':'Zoeken','Searching…':'Zoeken…','No results':'Geen resultaten','More results':'Meer resultaten','Play now':'Nu afspelen','Add to queue':'Aan wachtrij','Added to the queue':'Toegevoegd aan de wachtrij','Playing now':'Speelt nu','Search needs a connected Music Assistant.':'Zoeken werkt met een verbonden Music Assistant.','Bluetooth is playing. Choose and skip music on the connected phone; volume works here.':'Bluetooth speelt af. Kies en sla muziek over op de verbonden telefoon; volume werkt hier.','Unpair this phone':'Deze telefoon ontkoppelen','Unpair this phone? You need a new QR code to pair again.':'Deze telefoon ontkoppelen? Je hebt een nieuwe QR-code nodig om opnieuw te koppelen.','Cancel':'Annuleren','Unpair':'Ontkoppelen','Working…':'Bezig…','TuneBox could not be reached. Check the Wi-Fi connection.':'TuneBox is niet bereikbaar. Controleer de wifi-verbinding.','track':'nummer','album':'album','playlist':'playlist','radio':'radio','artist':'artiest'},
};
let lang='en';
const t=key=>words[lang]?.[key]??key;
const phoneName=()=>{const ua=navigator.userAgent||'';return /iPhone/.test(ua)?'iPhone':/iPad/.test(ua)?'iPad':/Android/.test(ua)?'Android phone':'Phone';};
async function api(path,body){
 const response=await fetch(path,{cache:'no-store',credentials:'same-origin',method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 let value={};try{value=await response.json();}catch{}
 if(!response.ok)throw Object.assign(Error(value.error||t('TuneBox could not be reached. Check the Wi-Fi connection.')),{status:response.status,state:value.state});
 return value;
}

function Remote(){
 const [phase,setPhase]=useState('opening'),[view,setView]=useState(null),[pending,setPending]=useState(''),[error,setError]=useState(''),[online,setOnline]=useState(true),[,setLang]=useState(lang);
 const busy=useRef(false);
 const apply=useCallback(value=>{if(!value?.playback)return;setView(value);if(value.language!==lang){lang=value.language;document.documentElement.lang=lang;setLang(lang);}},[]);
 // Pair from the QR fragment once, then forget the code from the address bar.
 useEffect(()=>{let live=true;(async()=>{
  const token=new URLSearchParams(location.hash.slice(1)).get('pair');
  if(token){history.replaceState(null,'',location.pathname);setPhase('pairing');try{await api('/api/remote/pair',{token,name:phoneName()});}catch(e){if(live){setError(e.message);}}}
  try{const s=await api('/api/remote/session');if(!live)return;setPhase(s.paired?'paired':'unpaired');}catch(e){if(live){setPhase('unpaired');setError(e.message);}}
 })();return()=>{live=false;};},[]);
 useEffect(()=>{
  if(phase!=='paired')return;let source,retry,closed=false;
  const connect=()=>{source=new EventSource('/api/remote/events');source.onmessage=e=>{try{apply(JSON.parse(e.data));setOnline(true);}catch{}};source.onerror=()=>{source.close();if(closed)return;
   // A short stream interruption is not an outage: only an unreachable TuneBox shows Reconnecting.
   retry=setTimeout(async()=>{try{const s=await api('/api/remote/session');if(!s.paired){setPhase('unpaired');return;}}catch{setOnline(false);}if(!closed)connect();},1500);};};
  connect();return()=>{closed=true;clearTimeout(retry);source?.close();};
 },[phase,apply]);
 async function act(label,path,body){
  if(busy.current)return null;busy.current=true;setPending(label);setError('');
  try{const value=await api(path,body);apply(value);return value;}
  catch(e){if(e.status===401)setPhase('unpaired');if(e.state)apply(e.state);setError(e.message);return null;}
  finally{busy.current=false;setPending('');}
 }
 if(phase==='opening'||phase==='pairing')return <main className="remote"><p className="remote-wait" role="status"><span className="remote-spinner" aria-hidden="true"/>{t(phase==='pairing'?'Pairing with TuneBox…':'Opening TuneBox remote…')}</p></main>;
 if(phase==='unpaired')return <main className="remote remote-unpaired"><h1>TuneBox</h1><h2>{t('Scan the QR code on TuneBox')}</h2><p>{t('On TuneBox, open Settings → Connections → Phone remote and choose Pair a phone.')}</p><p>{t('Your phone must be on the same Wi-Fi network as TuneBox.')}</p>{error&&<p role="alert" className="remote-error">{error}</p>}</main>;
 if(!view)return <main className="remote"><p className="remote-wait" role="status"><span className="remote-spinner" aria-hidden="true"/>{t('Opening TuneBox remote…')}</p></main>;
 return <Player view={view} pending={pending} error={error} online={online} act={act} onUnpaired={()=>setPhase('unpaired')}/>;
}

function Player({view,pending,error,online,act,onUnpaired}){
 const p=view.playback,bt=view.bluetooth,disabled=!!pending||!online,volumeKnown=Number.isFinite(p.volume);
 const [leave,setLeave]=useState(false);
 const step=delta=>act(delta>0?'Volume up':'Volume down','/api/remote/event',{type:'volume',value:Math.max(0,Math.min(view.volumeLimit,(p.volume||0)+delta))});
 return <main className="remote" aria-busy={!!pending}>
  <header className="remote-top"><strong>TuneBox</strong><span className={online?'remote-online':'remote-offline'} role="status">{online?(p.playerName||t('Paired with TuneBox')):t('Reconnecting to TuneBox…')}</span></header>
  <section className="remote-now" aria-label={p.title||t('Nothing is playing')}>
   <div className="remote-art">{p.artwork?<img src={p.artwork} alt=""/>:<Icon name="playing" size={64}/>}</div>
   <h1>{p.title||t('Nothing is playing')}</h1>{p.artist&&<p>{p.artist}</p>}{p.album&&<p className="remote-album">{p.album}</p>}
  </section>
  {bt&&<p className="remote-note">{t('Bluetooth is playing. Choose and skip music on the connected phone; volume works here.')}</p>}
  <section className="remote-transport">
   <button aria-label={t('Previous')} disabled={disabled||bt} onClick={()=>act('Previous','/api/remote/event',{type:'previous'})}><Icon name="previous" size={34}/></button>
   <button className="remote-main" aria-label={t(p.playing?'Pause':'Play')} disabled={disabled||bt} onClick={()=>act(p.playing?'Pause':'Play','/api/remote/event',{type:p.playing?'pause':'play'})}><Icon name={p.playing?'pause':'play'} size={44}/></button>
   <button aria-label={t('Next')} disabled={disabled||bt} onClick={()=>act('Next','/api/remote/event',{type:'next'})}><Icon name="next" size={34}/></button>
  </section>
  <section className="remote-volume" aria-label={t('Volume')}>
   <button aria-label={t('Volume down')} disabled={disabled||!volumeKnown||p.volume<=0} onClick={()=>step(-5)}>−</button>
   <div className="remote-level"><div role="meter" aria-label={t('Volume')} aria-valuemin={0} aria-valuemax={view.volumeLimit} aria-valuenow={volumeKnown?p.volume:0}><span style={{width:`${volumeKnown&&view.volumeLimit?Math.min(100,p.volume/view.volumeLimit*100):0}%`}}/></div><small>{volumeKnown?`${p.volume}%`:'—'} · {t('limit')} {view.volumeLimit}%</small></div>
   <button aria-label={t('Volume up')} disabled={disabled||!volumeKnown||p.volume>=view.volumeLimit} onClick={()=>step(5)}>+</button>
   {!bt&&<button className="remote-mute" aria-pressed={p.muted} aria-label={t(p.muted?'Unmute':'Mute')} disabled={disabled} onClick={()=>act('Mute','/api/remote/event',{type:'mute',value:!p.muted})}><Icon name={p.muted?'mute':'volume'} size={26}/></button>}
  </section>
  <p className="remote-status" role={error?'alert':'status'} aria-live="polite">{error||(pending?<><span className="remote-spinner" aria-hidden="true"/>{t('Working…')}</>:'')}</p>
  <Search view={view} disabled={disabled} act={act}/>
  <footer className="remote-footer"><button onClick={()=>setLeave(true)}>{t('Unpair this phone')}</button></footer>
  {leave&&<div className="remote-sheet" role="dialog" aria-modal="true" aria-label={t('Unpair this phone')}><p>{t('Unpair this phone? You need a new QR code to pair again.')}</p><button onClick={()=>setLeave(false)}>{t('Cancel')}</button><button onClick={async()=>{await api('/api/remote/leave',{}).catch(()=>{});onUnpaired();}}>{t('Unpair')}</button></div>}
 </main>;
}

function Search({view,disabled,act}){
 const [query,setQuery]=useState(''),[result,setResult]=useState(null),[searching,setSearching]=useState(false),[notice,setNotice]=useState(''),[failed,setFailed]=useState(false);
 const run=async(offset=0)=>{const q=query.trim();if(!q||searching)return;setSearching(true);setNotice('');setFailed(false);
  try{const value=await api(`/api/remote/search?q=${encodeURIComponent(q)}&offset=${offset}`);setResult(old=>({q,items:offset&&old?.q===q?[...old.items,...value.items]:value.items,hasMore:value.hasMore,next:offset+value.items.length}));}
  catch(e){setFailed(true);setNotice(e.message);}finally{setSearching(false);}};
 if(!view.searchAvailable)return <section className="remote-search"><h2>{t('Search music')}</h2><p className="remote-note">{t('Search needs a connected Music Assistant.')}</p></section>;
 return <section className="remote-search" aria-busy={searching}>
  <h2>{t('Search music')}</h2>
  <form role="search" onSubmit={e=>{e.preventDefault();run(0);}}><input type="search" enterKeyHint="search" maxLength={120} aria-label={t('Search music')} placeholder={t('Song, artist, album or playlist')} value={query} onChange={e=>setQuery(e.target.value)}/><button disabled={searching||!query.trim()} aria-label={t('Search')}>{searching?<span className="remote-spinner" aria-hidden="true"/>:<Icon name="search" size={24}/>}</button></form>
  <p role={failed?'alert':'status'} className="remote-status">{searching?t('Searching…'):notice}</p>
  {result&&(result.items.length?<ul className="remote-results">{result.items.map(item=><li key={item.id}>
   {item.artwork?<img src={item.artwork} alt=""/>:<span className="remote-thumb"><Icon name="library" size={24}/></span>}
   <span className="remote-result-text"><strong>{item.name}</strong><small>{[t(item.type||''),item.artist].filter(Boolean).join(' · ')}</small></span>
   {item.type!=='artist'&&item.available&&<span className="remote-result-actions"><button disabled={disabled} onClick={async()=>{if(await act('Play now','/api/remote/play',{id:item.id,option:'replace'}))setNotice(t('Playing now'));}}>{t('Play now')}</button><button disabled={disabled} onClick={async()=>{if(await act('Add to queue','/api/remote/play',{id:item.id,option:'add'}))setNotice(t('Added to the queue'));}}>{t('Add to queue')}</button></span>}
  </li>)}</ul>:<p>{t('No results')}</p>)}
  {result?.hasMore&&<button className="remote-more" disabled={searching} onClick={()=>run(result.next)}>{t('More results')}</button>}
 </section>;
}

createRoot(document.getElementById('remote')).render(<Remote/>);
