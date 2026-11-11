import {tr} from "../shared/i18n.js";
import React,{useEffect,useRef,useState} from 'react';
import {Icon} from './Icon.jsx';
import {sleepModes,screenSettings,sunsetAt,wallNotifications} from '../shared/wall.js';
import {useTemperatureDisplay} from './useTemperatureDisplay.js';
import {getLanguage} from '../shared/i18n.js';
import {PowerOffButton} from './PowerControls.jsx';
const labels={clock:'Klok & datum',widgets:'Widgets',sunset:'Zonsondergang',glow:'Glow',playing:'Now playing',black:'Zwart'};
export function ScreenSettings({prefs,update}) {
 const screen=screenSettings(prefs.screen);
 const change=(key,value)=>update('screen',{...screen,[key]:value});
 return <div className="screen-settings control-grid"><label>{tr("Schermrust")}<select aria-label={tr("Schermrust weergave")} value={screen.mode} onChange={e=>change('mode',e.target.value)}>{sleepModes.map(id=><option key={id} value={id}>{tr(labels[id])}</option>)}</select></label>
 <label>{tr("Breedtegraad")}<input aria-label={tr("Breedtegraad")} type="number" min="-90" max="90" step="any" value={screen.latitude??''} onChange={e=>change('latitude',e.target.value===''?null:Number(e.target.value))}/></label>
 <label>{tr("Lengtegraad")}<input aria-label={tr("Lengtegraad")} type="number" min="-180" max="180" step="any" value={screen.longitude??''} onChange={e=>change('longitude',e.target.value===''?null:Number(e.target.value))}/></label>
 <p>{tr("Screen rest keeps your music playing. The first touch wakes the display without pressing a playback control.")}</p>
 <p>{tr("Zonsondergang wordt lokaal berekend voor deze coördinaten, bij benadering. Geen locatie ingesteld betekent geen berekende zonsondergang. Coördinaten blijven in deze browser.")}</p>
 </div>;
}
export function SleepSurface({prefs,snapshot,offline,wake,waking=false}) {
 const [now,setNow]=useState(()=>new Date());const root=useRef(null);
 useEffect(()=>{const previous=document.activeElement;root.current?.focus();const timer=setInterval(()=>setNow(new Date()),30000);return()=>{clearInterval(timer);if(previous?.isConnected)previous.focus();};},[]);
 const screen=screenSettings(prefs.screen),track=snapshot.playback?.queue?.[snapshot.playback?.index];
 const sunset=sunsetAt(now,screen.latitude,screen.longitude);
 const locale=getLanguage()==='nl'?'nl-NL':'en-GB';
 const temperature=useTemperatureDisplay(snapshot.hardwareTelemetry?.temperature,offline);
 const time=now.toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'});
 const sunsetText=sunset?sunset.toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'}):'Location not set';
 const reading=(metric,digits,unit)=>!offline&&metric?.status==='ok'&&Number.isFinite(metric.value)?metric.value.toFixed(digits)+' '+unit:'Niet beschikbaar';
 return <button ref={root} className="sleep-surface" data-mode={screen.mode} data-waking={waking} aria-label={tr("Scherm wekken")} aria-busy={waking} onClick={wake}>
 {snapshot.device.faults?.length>0&&!offline&&<span role="alert" className="sleep-fault"><Icon name="alert" size={28}/>{tr("Hardware alert · ")}{tr(snapshot.device.faults.join(', '))}</span>}
 {screen.mode!=='black'&&<>
 {screen.mode!=='playing'&&<><strong className="sleep-clock">{tr(time)}</strong><span className="sleep-date">{tr(now.toLocaleDateString(locale,{weekday:'long',day:'numeric',month:'long'}))}</span></>}
 {screen.mode==='widgets'&&<div className="sleep-widgets"><span><Icon name="temperature" size={30}/>{tr("Temperatuur")}<strong>{tr(reading({...snapshot.hardwareTelemetry?.temperature,value:temperature},1,'°C'))}</strong></span><span><Icon name="sun" size={30}/>{tr("Omgevingslicht")}<strong>{tr(reading(snapshot.hardwareTelemetry?.light,0,'lux'))}</strong></span><span><Icon name="sunset" size={30}/>{tr("Zonsondergang")}<strong>{tr(sunsetText)}</strong></span></div>}
 {screen.mode==='sunset'&&<span className="sleep-sunset"><Icon name="sunset" size={32}/>{tr(sunsetText)}{tr(" · berekend")}</span>}
 {screen.mode==='playing'&&<div className="sleep-playing"><Icon name="play" size={48}/><strong>{offline?'Offline':track?.title||tr("Geen nummer")}</strong><span>{offline?tr("Metadata niet actueel"):track?.artist||''}</span><small>{tr(snapshot.playback?.playing?'Speelt':'Gepauzeerd')} · {tr(snapshot.mode==='simulation'?'gesimuleerd':'Music Assistant')}</small></div>}
 <small className="sleep-wake-hint">{tr("Tik om te wekken")}{tr(offline?' · offline':'')}</small></>}
 {waking&&<span className="wake-feedback" role="status"><span className="wake-spinner"/>{tr("Waking…")}</span>}
 </button>;
}
export function WallControls({snapshot,offline,updates,onSleep,onNavigate}) {
 const dialog=useRef(null),trigger=useRef(null);const [page,setPage]=useState(0);
 const notifications=wallNotifications(snapshot,updates?.info,offline),item=notifications[page];
 const open=()=>{setPage(0);dialog.current.showModal();};
 const navigate=id=>{dialog.current.close();onNavigate(id);};
 return <><button aria-label={tr("Schermrust")} onClick={onSleep}><Icon name="moon" size={24}/></button><PowerOffButton offline={offline}/>
 <button ref={trigger} aria-label={tr("Meldingen")} className="wall-bell" onClick={open}><Icon name="bell" size={24}/>{notifications.some(n=>n.attention)&&<i aria-label={tr("Aandacht vereist")}/>}</button>
 <dialog ref={dialog} className="wall-notifications" aria-label={tr("Meldingenpaneel")} onClose={()=>trigger.current?.focus()} onClick={e=>{if(e.target===e.currentTarget)dialog.current.close();}}>
 <div className="wall-tray"><header><h2>{tr("Meldingen")}</h2><button aria-label={tr("Meldingen sluiten")} onClick={()=>dialog.current.close()}><Icon name="close"/></button></header>
 <nav aria-label={tr("Meldingcategorieën")}>{notifications.map((n,i)=><button key={n.id} aria-label={tr(n.title)} aria-pressed={page===i} onClick={()=>setPage(i)}><Icon name={n.icon} size={25}/></button>)}</nav>
 <article data-attention={item.attention||false}><Icon name={item.icon} size={36}/><h3>{tr(item.title)}</h3>{item.simulated&&<small>{tr("GESIMULEERDE HARDWARESTATUS")}</small>}<p>{tr(item.detail)}</p>
 {item.action&&<button onClick={()=>navigate(item.action)}>{tr("Open ")}{tr(item.title)}</button>}
 {item.id==='status'&&<><p>{tr("Versterker: ")}{tr(snapshot.device?.verified?'simulatie geverifieerd':'niet geverifieerd')}{tr(" · fouten: ")}{tr(snapshot.device?.faults?.length||0)}</p><button onClick={()=>navigate('screen')}>{tr("Schermrust instellen")}</button></>}
 {item.id==='tutorial'&&<button onClick={()=>navigate('playing')}>{tr("Open Nu spelen")}</button>}
 </article><footer><button aria-label={tr("Vorige melding")} disabled={page===0} onClick={()=>setPage(p=>p-1)}>←</button><span>{tr(page+1)} / {tr(notifications.length)}</span><button aria-label={tr("Volgende melding")} disabled={page===notifications.length-1} onClick={()=>setPage(p=>p+1)}>→</button></footer></div></dialog></>;
}
