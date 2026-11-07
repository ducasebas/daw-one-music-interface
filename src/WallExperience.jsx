import React,{useEffect,useRef,useState} from 'react';
import {Icon} from './Icon.jsx';
import {sleepModes,screenSettings,sunsetAt,wallNotifications} from '../shared/wall.js';
const labels={clock:'Klok & datum',widgets:'Widgets',sunset:'Zonsondergang',glow:'Glow',playing:'Now playing',black:'Zwart'};
export function ScreenSettings({prefs,update}) {
 const screen=screenSettings(prefs.screen);
 const change=(key,value)=>update('screen',{...screen,[key]:value});
 return <div className="screen-settings control-grid"><label>Schermrust<select aria-label="Schermrust weergave" value={screen.mode} onChange={e=>change('mode',e.target.value)}>{sleepModes.map(id=><option key={id} value={id}>{labels[id]}</option>)}</select></label>
 <label>Breedtegraad<input aria-label="Breedtegraad" type="number" min="-90" max="90" step="any" value={screen.latitude??''} onChange={e=>change('latitude',e.target.value===''?null:Number(e.target.value))}/></label>
 <label>Lengtegraad<input aria-label="Lengtegraad" type="number" min="-180" max="180" step="any" value={screen.longitude??''} onChange={e=>change('longitude',e.target.value===''?null:Number(e.target.value))}/></label>
 <p>Schermrust is onafhankelijk van muziek en apparaatstand-by. Tik op de maan om te testen. Automatisch na de bestaande 30 seconden zonder bediening.</p>
 <p>Zonsondergang wordt lokaal berekend voor deze coördinaten, bij benadering. Geen locatie ingesteld betekent geen berekende zonsondergang. Coördinaten blijven in deze browser.</p>
 <p>Zwart is een zwart beeld; fysieke DSI-backlightuitschakeling is nog niet gekoppeld. Schermrust is actief in het nieuwe wandprofiel.</p></div>;
}
export function SleepSurface({prefs,snapshot,offline,wake}) {
 const [now,setNow]=useState(()=>new Date());const root=useRef(null);
 useEffect(()=>{const previous=document.activeElement;root.current?.focus();const timer=setInterval(()=>setNow(new Date()),30000);return()=>{clearInterval(timer);if(previous?.isConnected)previous.focus();};},[]);
 const screen=screenSettings(prefs.screen),track=snapshot.playback?.queue?.[snapshot.playback?.index];
 const sunset=sunsetAt(now,screen.latitude,screen.longitude);
 const time=now.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});
 const sunsetText=sunset?sunset.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'}):'Locatie onbekend of vandaag geen zonsondergang';
 const reading=(metric,digits,unit)=>!offline&&metric?.status==='ok'&&Number.isFinite(metric.value)?metric.value.toFixed(digits)+' '+unit:'Niet beschikbaar';
 return <button ref={root} className="sleep-surface" data-mode={screen.mode} aria-label="Scherm wekken" onClick={wake}>
 {snapshot.device.faults?.length>0&&!offline&&<span role="alert" className="sleep-fault"><Icon name="alert" size={28}/>Hardware alert · {snapshot.device.faults.join(', ')}</span>}
 {screen.mode!=='black'&&<><small>DAW TUNEBOX · {snapshot.device.mode==='standby'?'APPARAAT-STAND-BY':'SCHERMRUST'}</small>
 {screen.mode!=='playing'&&<><strong className="sleep-clock">{time}</strong><span>{now.toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long'})}</span></>}
 {screen.mode==='widgets'&&<div className="sleep-widgets"><span>Temperatuur<strong>{reading(snapshot.hardwareTelemetry?.temperature,1,'°C')}</strong></span><span>Omgevingslicht<strong>{reading(snapshot.hardwareTelemetry?.light,0,'lux')}</strong></span><span>Zonsondergang<strong>{sunsetText}</strong></span></div>}
 {screen.mode==='sunset'&&<span className="sleep-sunset"><Icon name="sunset" size={32}/>{sunsetText} · berekend</span>}
 {screen.mode==='playing'&&<div className="sleep-playing"><Icon name="play" size={48}/><strong>{offline?'Offline':track?.title||'Geen nummer'}</strong><span>{offline?'Metadata niet actueel':track?.artist||''}</span><small>{snapshot.playback?.playing?'Speelt':'Gepauzeerd'} · {snapshot.mode==='simulation'?'gesimuleerd':'Music Assistant'}</small></div>}
 <small>Tik om te wekken{offline?' · offline':''}</small></>}
 </button>;
}
export function WallControls({snapshot,offline,updates,onSleep,onNavigate}) {
 const dialog=useRef(null),trigger=useRef(null);const [page,setPage]=useState(0);
 const notifications=wallNotifications(snapshot,updates?.info,offline),item=notifications[page];
 const open=()=>{setPage(0);dialog.current.showModal();};
 const navigate=id=>{dialog.current.close();onNavigate(id);};
 return <><button aria-label="Schermrust" onClick={onSleep}><Icon name="moon" size={24}/></button>
 <button ref={trigger} aria-label="Meldingen" className="wall-bell" onClick={open}><Icon name="bell" size={24}/>{notifications.some(n=>n.attention)&&<i aria-label="Aandacht vereist"/>}</button>
 <dialog ref={dialog} className="wall-notifications" aria-label="Meldingenpaneel" onClose={()=>trigger.current?.focus()} onClick={e=>{if(e.target===e.currentTarget)dialog.current.close();}}>
 <div className="wall-tray"><header><h2>Meldingen</h2><button aria-label="Meldingen sluiten" onClick={()=>dialog.current.close()}><Icon name="close"/></button></header>
 <nav aria-label="Meldingcategorieën">{notifications.map((n,i)=><button key={n.id} aria-label={n.title} aria-pressed={page===i} onClick={()=>setPage(i)}><Icon name={n.icon} size={25}/></button>)}</nav>
 <article data-attention={item.attention||false}><Icon name={item.icon} size={36}/><h3>{item.title}</h3>{item.simulated&&<small>GESIMULEERDE HARDWARESTATUS</small>}<p>{item.detail}</p>
 {item.action&&<button onClick={()=>navigate(item.action)}>Open {item.title}</button>}
 {item.id==='status'&&<><p>Versterker: {snapshot.device?.verified?'simulatie geverifieerd':'niet geverifieerd'} · fouten: {snapshot.device?.faults?.length||0}</p><button onClick={()=>navigate('screen')}>Schermrust instellen</button></>}
 {item.id==='tutorial'&&<button onClick={()=>navigate('playing')}>Open Nu spelen</button>}
 </article><footer><button aria-label="Vorige melding" disabled={page===0} onClick={()=>setPage(p=>p-1)}>←</button><span>{page+1} / {notifications.length}</span><button aria-label="Volgende melding" disabled={page===notifications.length-1} onClick={()=>setPage(p=>p+1)}>→</button></footer></div></dialog></>;
}
