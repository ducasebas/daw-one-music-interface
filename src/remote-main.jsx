import React,{useCallback,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Icon} from './Icon.jsx';
import qrcode from 'qrcode-generator';
import './remote.css';

/*
 * Phone remote for one TuneBox. Deliberately small and separate from the wall app:
 * it only plays, pauses, skips, searches and changes volume through /api/remote/*.
 */
const words={
 nl:{'TuneBox notifications':'TuneBox-meldingen','Dismiss':'Verbergen','Update available':'Update beschikbaar','Check Music Assistant':'Controleer Music Assistant','Hardware alert':'Hardwaremelding','Update needs attention':'Update vraagt aandacht','Invite a phone':'Telefoon uitnodigen','Let the other phone scan this code. It works once and expires in 10 minutes.':'Laat de andere telefoon deze code scannen. Hij werkt één keer en verloopt na 10 minuten.','Invitation QR code':'QR-code voor de uitnodiging','The other phone also needs the TuneBox settings PIN.':'De andere telefoon heeft ook de pincode van TuneBox nodig.','Share link':'Link delen','Copy link':'Link kopiëren','Link copied':'Link gekopieerd','Copy the link by hand.':'Kopieer de link met de hand.','Control the music on TuneBox':'Bedien de muziek op TuneBox','Close':'Sluiten','Enter the TuneBox PIN':'Voer de TuneBox-pincode in','This TuneBox uses a settings PIN. Ask the owner for it to control the music.':'Deze TuneBox gebruikt een pincode voor instellingen. Vraag die aan de eigenaar om de muziek te bedienen.','PIN':'Pincode','Pair':'Koppelen','Checking…':'Controleren…','That PIN is not correct.':'Die pincode klopt niet.','Enter the TuneBox settings PIN to pair this phone.':'Voer de pincode van TuneBox in om deze telefoon te koppelen.','Music is waiting in the queue':'Er staat muziek in de wachtrij','1 track is queued after the current one.':'Er staat 1 nummer na het huidige.','{count} tracks are queued after the current one.':'Er staan {count} nummers na het huidige.','Play next':'Als volgende','Add to the end':'Achteraan toevoegen','Replace the queue':'Wachtrij vervangen','Plays after the current track':'Speelt na het huidige nummer','Added to the queue':'Toegevoegd aan de wachtrij','Up next':'Hierna','Track position':'Positie in het nummer','Opening TuneBox remote…':'Afstandsbediening openen…','Pairing with TuneBox…':'Koppelen met TuneBox…','Scan the QR code on TuneBox':'Scan de QR-code op TuneBox','On TuneBox, open Settings → Connections → Phone remote and choose Pair a phone.':'Open op TuneBox Instellingen → Verbindingen → Telefoon-afstandsbediening en kies Telefoon koppelen.','Your phone must be on the same Wi-Fi network as TuneBox.':'Je telefoon moet op hetzelfde wifi-netwerk zitten als TuneBox.','Paired with TuneBox':'Gekoppeld met TuneBox','Reconnecting to TuneBox…':'Opnieuw verbinden met TuneBox…','Nothing is playing':'Er speelt niets','Play':'Afspelen','Pause':'Pauzeren','Previous':'Vorige','Next':'Volgende','Volume down':'Zachter','Volume up':'Harder','Mute':'Dempen','Unmute':'Dempen opheffen','Volume':'Volume','limit':'limiet','Search music':'Muziek zoeken','Song, artist, album or playlist':'Nummer, artiest, album of playlist','Search':'Zoeken','Searching…':'Zoeken…','No results':'Geen resultaten','More results':'Meer resultaten','Play now':'Nu afspelen','Add to queue':'Aan wachtrij','Added to the queue':'Toegevoegd aan de wachtrij','Playing now':'Speelt nu','Search needs a connected Music Assistant.':'Zoeken werkt met een verbonden Music Assistant.','Bluetooth is playing. Choose and skip music on the connected phone; volume works here.':'Bluetooth speelt af. Kies en sla muziek over op de verbonden telefoon; volume werkt hier.','Unpair this phone':'Deze telefoon ontkoppelen','Unpair this phone? You need a new QR code to pair again.':'Deze telefoon ontkoppelen? Je hebt een nieuwe QR-code nodig om opnieuw te koppelen.','Cancel':'Annuleren','Unpair':'Ontkoppelen','Working…':'Bezig…','TuneBox could not be reached. Check the Wi-Fi connection.':'TuneBox is niet bereikbaar. Controleer de wifi-verbinding.','track':'nummer','album':'album','playlist':'playlist','radio':'radio','artist':'artiest'},
};
let lang='en';
const t=key=>words[lang]?.[key]??key;
const phoneName=()=>{const ua=navigator.userAgent||'';return /iPhone/.test(ua)?'iPhone':/iPad/.test(ua)?'iPad':/Android/.test(ua)?'Android phone':'Phone';};
async function api(path,body){
 const response=await fetch(path,{cache:'no-store',credentials:'same-origin',method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 let value={};try{value=await response.json();}catch{}
 if(!response.ok)throw Object.assign(Error(value.error||t('TuneBox could not be reached. Check the Wi-Fi connection.')),{status:response.status,state:value.state,code:value.code,upcoming:value.upcoming});
 return value;
}

function Remote(){
 const [phase,setPhase]=useState('opening'),[view,setView]=useState(null),[pending,setPending]=useState(''),[error,setError]=useState(''),[online,setOnline]=useState(true),[,setLang]=useState(lang);
 const busy=useRef(false),pendingToken=useRef(null);
 // The TuneBox settings PIN is asked once, after scanning; the code stays valid on a typo.
 async function submitPin(pin){
  setError('');try{await api('/api/remote/pair',{token:pendingToken.current,name:phoneName(),pin});pendingToken.current=null;setPhase('paired');}
  catch(e){setError(e.message);if(!['pin-wrong','pin-required'].includes(e.code)){pendingToken.current=null;setPhase('unpaired');}}
 }
 const apply=useCallback(value=>{if(!value?.playback)return;setView(value);if(value.language!==lang){lang=value.language;document.documentElement.lang=lang;setLang(lang);}},[]);
 // Pair from the QR fragment once, then forget the code from the address bar.
 useEffect(()=>{let live=true;(async()=>{
  const token=new URLSearchParams(location.hash.slice(1)).get('pair');
  if(token){history.replaceState(null,'',location.pathname);setPhase('pairing');try{await api('/api/remote/pair',{token,name:phoneName()});}catch(e){if(live){if(e.code==='pin-required'){pendingToken.current=token;setPhase('pin');return;}setError(e.message);}}}
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
  catch(e){if(e.code==='queue-not-empty')return {queueChoice:true,upcoming:e.upcoming||0};if(e.status===401)setPhase('unpaired');if(e.state)apply(e.state);setError(e.message);return null;}
  finally{busy.current=false;setPending('');}
 }
 if(phase==='opening'||phase==='pairing')return <main className="remote"><p className="remote-wait" role="status"><span className="remote-spinner" aria-hidden="true"/>{t(phase==='pairing'?'Pairing with TuneBox…':'Opening TuneBox remote…')}</p></main>;
 if(phase==='pin')return <PinEntry error={error} onSubmit={submitPin}/>;
 if(phase==='unpaired')return <main className="remote remote-unpaired"><h1>TuneBox</h1><h2>{t('Scan the QR code on TuneBox')}</h2><p>{t('On TuneBox, open Settings → Connections → Phone remote and choose Pair a phone.')}</p><p>{t('Your phone must be on the same Wi-Fi network as TuneBox.')}</p>{error&&<p role="alert" className="remote-error">{error}</p>}</main>;
 if(!view)return <main className="remote"><p className="remote-wait" role="status"><span className="remote-spinner" aria-hidden="true"/>{t('Opening TuneBox remote…')}</p></main>;
 return <Player view={view} pending={pending} error={error} online={online} act={act} onUnpaired={()=>setPhase('unpaired')}/>;
}

const styleKeys={background:'--remote-bg',surface:'--remote-panel',text:'--remote-text',muted:'--remote-muted',accent:'--remote-accent',font:'--remote-font',radius:'--remote-radius'};
/** The phone follows the TuneBox skin: same colours and font, applied as CSS variables. */
function useTuneBoxStyle(style){
 useEffect(()=>{const root=document.documentElement;
  for(const [key,name] of Object.entries(styleKeys)){const v=style?.[key];if(typeof v==='string'&&v.length<120&&!/[;{}<>]/.test(v))root.style.setProperty(name,v);else root.style.removeProperty(name);}
  root.dataset.skin=style?.skin||'';
  root.dataset.weight=style?.weight==='heavy'?'heavy':'normal';
  const meta=document.querySelector('meta[name=theme-color]');if(meta&&style?.background)meta.setAttribute('content',style.background);
 },[style?.skin,style?.background,style?.accent,style?.text,style?.surface,style?.muted,style?.font,style?.radius,style?.weight]);
}
const clock=n=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
/** Read-only progress: the phone shows where the track is, it does not seek. */
function Progress({p}){
 const [now,setNow]=useState(Date.now);
 useEffect(()=>{if(!p.playing||!p.duration)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[p.playing,p.duration]);
 if(!p.duration)return null;
 const at=Math.max(0,Math.min(p.duration,p.position+(p.playing&&p.observedAt?Math.max(0,now-p.observedAt)/1000:0)));
 return <div className="remote-progress" aria-label={t('Track position')}><div><span style={{width:`${at/p.duration*100}%`}}/></div><small><span>{clock(at)}</span><span>{clock(p.duration)}</span></small></div>;
}
function PinEntry({error,onSubmit}){
 const [pin,setPin]=useState(''),[sending,setSending]=useState(false);
 return <main className="remote remote-unpaired"><h1>TuneBox</h1><h2>{t('Enter the TuneBox PIN')}</h2><p>{t('This TuneBox uses a settings PIN. Ask the owner for it to control the music.')}</p>
  <form className="remote-pin" onSubmit={async e=>{e.preventDefault();if(pin.length!==6||sending)return;setSending(true);await onSubmit(pin);setSending(false);setPin('');}}>
   <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} aria-label={t('PIN')} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))}/>
   <button disabled={pin.length!==6||sending}>{t(sending?'Checking…':'Pair')}</button>
  </form>{error&&<p role="alert" className="remote-error">{t(error)}</p>}</main>;
}
/** TuneBox notifications on the phone; dismissed ones stay hidden on this phone until they change. */
function Notifications({items=[]}){
 const read=()=>{try{return JSON.parse(localStorage.getItem('tunebox-remote-dismissed')||'[]');}catch{return [];}};
 const [dismissed,setDismissed]=useState(read),seen=useRef(new Set());
 const key=n=>n.id+'|'+n.title+'|'+n.detail,visible=items.filter(n=>!dismissed.includes(key(n)));
 useEffect(()=>{const fresh=visible.filter(n=>!seen.current.has(key(n)));if(fresh.length&&seen.current.size&&navigator.vibrate)navigator.vibrate(120);for(const n of items)seen.current.add(key(n));},[items]);
 if(!visible.length)return null;
 const dismiss=n=>{const next=[...dismissed,key(n)].slice(-30);setDismissed(next);try{localStorage.setItem('tunebox-remote-dismissed',JSON.stringify(next));}catch{}};
 return <section className="remote-notifications" aria-label={t('TuneBox notifications')}>{visible.map(n=><article key={key(n)} role="status"><div><strong>{t(n.title)}</strong>{n.detail&&<span>{t(n.detail)}</span>}</div><button aria-label={t('Dismiss')} onClick={()=>dismiss(n)}>×</button></article>)}</section>;
}
/** Invite another phone: a single-use code with a QR to scan from this screen, or a link to send. */
function Invite(){
 const [invite,setInvite]=useState(null),[error,setError]=useState(''),[copied,setCopied]=useState(false);
 async function open(){setError('');setCopied(false);try{setInvite(await api('/api/remote/invite',{}));}catch(e){setError(e.message);}}
 const svg=invite?(()=>{const q=qrcode(0,'M');q.addData(invite.url);q.make();return q.createSvgTag({cellSize:6,margin:2,scalable:true});})():'';
 // The clipboard API can be refused (permissions, http on the LAN): fall back to the classic copy before giving up.
 async function copy(){
  setError('');
  try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(invite.url);setCopied(true);return;}}catch{}
  try{const area=document.createElement('textarea');area.value=invite.url;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();const ok=document.execCommand('copy');area.remove();if(ok){setCopied(true);return;}}catch{}
  setError(t('Copy the link by hand.'));
 }
 return <>
  <button onClick={open}>{t('Invite a phone')}</button>
  {error&&!invite&&<p role="alert" className="remote-error">{t(error)}</p>}
  {invite&&<div className="remote-sheet remote-invite" role="dialog" aria-modal="true" aria-label={t('Invite a phone')}>
   <h2>{t('Invite a phone')}</h2><p>{t('Let the other phone scan this code. It works once and expires in 10 minutes.')}</p>
   <div className="remote-qr" aria-label={t('Invitation QR code')} role="img" dangerouslySetInnerHTML={{__html:svg}}/>
   {invite.pinRequired&&<p>{t('The other phone also needs the TuneBox settings PIN.')}</p>}
   <code>{invite.url}</code>
   <div className="remote-invite-actions">{navigator.share&&<button onClick={()=>navigator.share({title:'TuneBox',text:t('Control the music on TuneBox'),url:invite.url}).catch(()=>{})}>{t('Share link')}</button>}<button onClick={copy}>{t(copied?'Link copied':'Copy link')}</button><button onClick={()=>setInvite(null)}>{t('Close')}</button></div>
   {error&&<p role="alert" className="remote-error">{t(error)}</p>}
  </div>}
 </>;
}
function Player({view,pending,error,online,act,onUnpaired}){
 const p=view.playback,bt=view.bluetooth,disabled=!!pending||!online,volumeKnown=Number.isFinite(p.volume);
 const [leave,setLeave]=useState(false);
 useTuneBoxStyle(view.style);
 const step=delta=>act(delta>0?'Volume up':'Volume down','/api/remote/event',{type:'volume',value:Math.max(0,Math.min(view.volumeLimit,(p.volume||0)+delta))});
 return <main className="remote" aria-busy={!!pending}>
  <header className="remote-top"><strong>TuneBox</strong><span className={online?'remote-online':'remote-offline'} role="status">{online?(p.playerName||t('Paired with TuneBox')):t('Reconnecting to TuneBox…')}</span></header>
  <Notifications items={view.notifications}/>
  {p.artwork&&<div className="remote-backdrop" aria-hidden="true"><div key={p.artwork} style={{backgroundImage:`url("${p.artwork.replace(/["\\]/g,'')}")`}}/></div>}
  <section className="remote-now" aria-label={p.title||t('Nothing is playing')}>
   <div className="remote-art">{p.artwork?<img src={p.artwork} alt=""/>:<Icon name="playing" size={64}/>}</div>
   <h1>{p.title||t('Nothing is playing')}</h1>{p.artist&&<p>{p.artist}</p>}{p.album&&<p className="remote-album">{p.album}</p>}
   {p.quality&&<p className="remote-quality">{p.quality}</p>}
   <Progress p={p}/>
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
  {p.next&&<section className="remote-next" aria-label={t('Up next')}><small>{t('Up next')}</small><strong>{p.next.title}</strong>{p.next.artist&&<span>{p.next.artist}</span>}</section>}
  <p className="remote-status" role={error?'alert':'status'} aria-live="polite">{error||(pending?<><span className="remote-spinner" aria-hidden="true"/>{t('Working…')}</>:'')}</p>
  <Search view={view} disabled={disabled} act={act}/>
  <footer className="remote-footer"><Invite/><button onClick={()=>setLeave(true)}>{t('Unpair this phone')}</button></footer>
  {leave&&<div className="remote-sheet" role="dialog" aria-modal="true" aria-label={t('Unpair this phone')}><p>{t('Unpair this phone? You need a new QR code to pair again.')}</p><button onClick={()=>setLeave(false)}>{t('Cancel')}</button><button onClick={async()=>{await api('/api/remote/leave',{}).catch(()=>{});onUnpaired();}}>{t('Unpair')}</button></div>}
 </main>;
}

function Search({view,disabled,act}){
 const [choice,setChoice]=useState(null);
 const pick=async how=>{const c=choice;setChoice(null);if(!c||how==='cancel')return;const done=await act(how==='next'?'Play next':how==='add'?'Add to queue':'Play now','/api/remote/play',{id:c.item.id,option:how,...(how==='replace'?{confirmReplace:true}:{})});if(done&&!done.queueChoice)setNotice(t(how==='replace'?'Playing now':how==='next'?'Plays after the current track':'Added to the queue'));};
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
   {item.type!=='artist'&&item.available&&<span className="remote-result-actions"><button disabled={disabled} onClick={async()=>{const done=await act('Play now','/api/remote/play',{id:item.id,option:'replace'});if(done?.queueChoice)setChoice({item,upcoming:done.upcoming});else if(done)setNotice(t('Playing now'));}}>{t('Play now')}</button><button disabled={disabled} onClick={async()=>{if(await act('Add to queue','/api/remote/play',{id:item.id,option:'add'}))setNotice(t('Added to the queue'));}}>{t('Add to queue')}</button></span>}
  </li>)}</ul>:<p>{t('No results')}</p>)}
  {choice&&<div className="remote-sheet" role="dialog" aria-modal="true" aria-label={t('Music is waiting in the queue')}><p><strong>{t('Music is waiting in the queue')}</strong></p><p>{(choice.upcoming===1?t('1 track is queued after the current one.'):t('{count} tracks are queued after the current one.').replace('{count}',choice.upcoming))}</p><button onClick={()=>pick('next')}>{t('Play next')}</button><button onClick={()=>pick('add')}>{t('Add to the end')}</button><button className="remote-danger" onClick={()=>pick('replace')}>{t('Replace the queue')}</button><button onClick={()=>pick('cancel')}>{t('Cancel')}</button></div>}
  {result?.hasMore&&<button className="remote-more" disabled={searching} onClick={()=>run(result.next)}>{t('More results')}</button>}
 </section>;
}

createRoot(document.getElementById('remote')).render(<Remote/>);
