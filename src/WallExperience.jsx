import {tr,translateFormat} from "../shared/i18n.js";
import React,{useEffect,useRef,useState} from 'react';
import {Icon} from './Icon.jsx';
import {sleepModes,screenSettings,sunsetAt,wallNotifications} from '../shared/wall.js';
import {restBackdrop,RestBackdrop} from './RestBackdrop.jsx';
import {restWidgets,widgetText} from '../shared/now-playing.js';
import {RestPicker} from './RestPicker.jsx';
import {trackUpdate,loadUpdateMemory,saveUpdateMemory} from '../shared/update-notice.js';
import {settingsAttention} from '../shared/interface.js';
import {useTemperatureDisplay} from './useTemperatureDisplay.js';
import {getLanguage} from '../shared/i18n.js';
import {AudioVisualizer} from './AudioVisualizer.jsx';
import {PowerOffButton} from './PowerControls.jsx';
const labels={clock:'Klok & datum',widgets:'Widgets',sunset:'Zonsondergang',glow:'Glow',playing:'Now playing',black:'Black · backlight off'};
export function ScreenSettings({prefs,update,snapshot}) {
 const screen=screenSettings(prefs.screen);
 const change=(key,value)=>update('screen',{...screen,[key]:value});
 return <div className="screen-settings control-grid"><RestPicker screen={prefs.screen} snapshot={snapshot} onChange={next=>update('screen',next)}/>
 <p className="screen-place">{tr(Number.isFinite(screen.latitude)?'Sunset follows the city chosen in Date & time.':'Choose your city in Date & time to use sunset.')}</p>
 <details className="screen-coordinates"><summary>{tr('Advanced: coordinates')}</summary>
 <label>{tr("Breedtegraad")}<input aria-label={tr("Breedtegraad")} type="number" min="-90" max="90" step="any" value={screen.latitude??''} onChange={e=>change('latitude',e.target.value===''?null:Number(e.target.value))}/></label>
 <label>{tr("Lengtegraad")}<input aria-label={tr("Lengtegraad")} type="number" min="-180" max="180" step="any" value={screen.longitude??''} onChange={e=>change('longitude',e.target.value===''?null:Number(e.target.value))}/></label></details>
 <p>{tr("Screen rest keeps your music playing. The first touch wakes the display without pressing a playback control.")}</p>
 <p>{tr("Zonsondergang wordt lokaal berekend voor deze coördinaten, bij benadering. Geen locatie ingesteld betekent geen berekende zonsondergang. Coördinaten blijven in deze browser.")}</p>
 </div>;
}
export function SleepSurface({prefs,snapshot,offline,wake,waking=false,armed=true,hold='idle',holdMs=650}) {
 const [now,setNow]=useState(()=>new Date());const root=useRef(null);
 useEffect(()=>{const previous=document.activeElement;root.current?.focus();const timer=setInterval(()=>setNow(new Date()),30000);return()=>{clearInterval(timer);if(previous?.isConnected)previous.focus();};},[]);
 const screen=screenSettings(prefs.screen),track=snapshot.playback?.queue?.[snapshot.playback?.index];
 const sunset=sunsetAt(now,screen.latitude,screen.longitude);
 const locale=getLanguage()==='nl'?'nl-NL':'en-GB';
 const temperature=useTemperatureDisplay(snapshot.hardwareTelemetry?.temperature,offline);
 const clock=snapshot.preferences?.clock||{};
 const clockOptions={timeZone:clock.timeZone||'Europe/Amsterdam',hour12:clock.hour12===true};
 const off=snapshot.screenOff===true;
 const restTiles=screen.mode==='widgets'?restWidgets(prefs.restWidgets,snapshot,{now:now.getTime(),offline}):[];
 const backdrop=off?null:restBackdrop(screen,{artwork:track?.artwork,restPhoto:snapshot.restPhoto});
 const meters=!off&&['vu','bars','spectrum'].includes(screen.mode);
 const time=now.toLocaleTimeString(locale,{...clockOptions,hour:'2-digit',minute:'2-digit'});
 const sunsetText=sunset?sunset.toLocaleTimeString(locale,{...clockOptions,hour:'2-digit',minute:'2-digit'}):'Location not set';
 const reading=(metric,digits,unit)=>!offline&&metric?.status==='ok'&&Number.isFinite(metric.value)?metric.value.toFixed(digits)+' '+unit:'Niet beschikbaar';
 return <button ref={root} className="sleep-surface" data-mode={off?'black':screen.mode} data-screen-off={off} data-armed={armed} data-hold={hold} data-backdrop={backdrop?.kind||'none'} data-waking={waking} aria-label={tr("Scherm wekken")} aria-busy={waking} onClick={wake}>
 {snapshot.device.faults?.length>0&&!offline&&<span role="alert" className="sleep-fault"><Icon name="alert" size={28}/>{tr("Hardware alert · ")}{tr(snapshot.device.faults.join(', '))}</span>}
 <RestBackdrop backdrop={backdrop}/>
 {screen.mode!=='black'&&!off&&<>
 {meters&&<span className="sleep-meters" style={{'--meter-left':screen.leftColor||'var(--accent)','--meter-right':screen.rightColor||'var(--accent)'}}><AudioVisualizer timing={prefs.timing} timeline={snapshot.playback} mode={screen.mode} offline={offline} awake paused={!snapshot.playback?.playing||snapshot.playback?.muted===true} reference={screen.meterReference||-18}/></span>}
 {screen.mode!=='playing'&&!meters&&<><strong className="sleep-clock">{tr(time)}</strong>{screen.showDate!==false&&<span className="sleep-date">{tr(now.toLocaleDateString(locale,{...clockOptions,weekday:'long',day:'numeric',month:'long'}))}</span>}</>}
 {screen.mode==='widgets'&&<div className="sleep-widgets" data-count={restTiles.length}>{restTiles.map(tile=><span key={tile.id} data-widget={tile.id} data-available={tile.available}><Icon name={tile.icon} size={30}/>{tr(tile.label)}<strong>{widgetText(tile.value,tile.params,tr)}</strong></span>)}</div>}
 {screen.mode==='sunset'&&<span className="sleep-sunset"><Icon name="sunset" size={32}/>{tr(sunsetText)}{tr(" · berekend")}</span>}
 {screen.mode==='playing'&&<div className="sleep-playing"><Icon name={snapshot.playback?.playing?"play":"pause"} size={48}/><strong>{offline?'Offline':track?.title||tr("Geen nummer")}</strong><span>{offline?tr("Metadata niet actueel"):track?.artist||''}</span><small>{tr(snapshot.playback?.playing?'Speelt':'Gepauzeerd')} · {tr(snapshot.mode==='simulation'?'gesimuleerd':'Music Assistant')}</small></div>}
 {screen.showHint!==false&&<small className="sleep-wake-hint">{tr("Hold to wake")}{tr(offline?' · offline':'')}</small>}</>}
 {hold==="holding"&&!waking&&<span className="wake-hold" aria-hidden="true" style={{"--hold-ms":holdMs+"ms"}}><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="28"/><circle className="wake-hold-fill" cx="32" cy="32" r="28" pathLength="100"/></svg></span>}
 {hold==="hint"&&!waking&&<span className="wake-feedback wake-hint" role="status">{tr("Hold to wake")}</span>}
 {waking&&<span className="wake-feedback" role="status"><span className="wake-spinner"/>{tr("Waking…")}</span>}
 </button>;
}
export function WallControls({snapshot,offline,updates,security,onSleep,onNavigate}) {
 const dialog=useRef(null),trigger=useRef(null);const [page,setPage]=useState(0);
 const [updateMemory,setUpdateMemory]=useState(()=>loadUpdateMemory());
 useEffect(()=>{setUpdateMemory(old=>{const next=trackUpdate(old,updates?.info);if(JSON.stringify(next)===JSON.stringify(old))return old;saveUpdateMemory(next);return next;});},[updates?.info]);
 const dismiss=()=>{const next={...updateMemory,outcome:null};saveUpdateMemory(next);setUpdateMemory(next);setPage(0);};
 const extra=settingsAttention(snapshot,updates?.info||{},security||{}).filter(n=>!['update','update-error','hardware','power'].includes(n.id)).map(n=>({...n,attention:true,action:n.section}));
 const notifications=[...wallNotifications(snapshot,updates?.info,offline,Date.now(),updateMemory),...extra],item=notifications[Math.min(page,notifications.length-1)];
 const open=()=>{setPage(Math.max(0,notifications.findIndex(n=>n.attention)));dialog.current.showModal();};
 const navigate=id=>{dialog.current.close();onNavigate(id);};
 return <><button aria-label={tr("Schermrust")} onClick={onSleep}><Icon name="moon" size={24}/></button><PowerOffButton offline={offline}/>
 <button ref={trigger} aria-label={tr("Meldingen")} className="wall-bell" onClick={open}><Icon name="bell" size={24}/>{notifications.some(n=>n.attention)&&<i aria-label={tr("Aandacht vereist")}/>}</button>
 <dialog ref={dialog} className="wall-notifications" aria-label={tr("Meldingenpaneel")} onClose={()=>trigger.current?.focus()} onClick={e=>{if(e.target===e.currentTarget)dialog.current.close();}}>
 <div className="wall-tray"><header><h2>{tr("Meldingen")}</h2><button aria-label={tr("Meldingen sluiten")} onClick={()=>dialog.current.close()}><Icon name="close"/></button></header>
 <nav aria-label={tr("Meldingcategorieën")}>{notifications.map((n,i)=><button key={n.id} aria-label={tr(n.title)} aria-pressed={page===i} onClick={()=>setPage(i)}><Icon name={n.icon} size={25}/>{n.attention&&<i className="attention-dot"/>}</button>)}</nav>
 <article data-attention={item.attention||false}><Icon name={item.icon} size={36}/><h3>{tr(item.title)}</h3>{item.simulated&&<small>{tr("GESIMULEERDE HARDWARESTATUS")}</small>}<p>{item.params?translateFormat(item.detail,item.params):tr(item.detail)}</p>
 {item.label&&<p>{tr(item.label)}</p>}{item.action&&<button onClick={()=>navigate(item.action)}>{tr(item.id==='update'?'Open Updates':'Open ')}{item.id==='update'?null:tr(item.title)}</button>}{item.dismissible&&<button onClick={dismiss}>{tr('Dismiss')}</button>}
 {item.id==='status'&&<><p>{tr("Versterker: ")}{tr(snapshot.device?.verified?'simulatie geverifieerd':'niet geverifieerd')}{tr(" · fouten: ")}{tr(snapshot.device?.faults?.length||0)}</p><button onClick={()=>navigate('screen')}>{tr("Schermrust instellen")}</button></>}
 {item.id==='tutorial'&&<button onClick={()=>navigate('playing')}>{tr("Open Nu spelen")}</button>}
 </article><footer><button aria-label={tr("Vorige melding")} disabled={page===0} onClick={()=>setPage(p=>p-1)}>←</button><span>{tr(page+1)} / {tr(notifications.length)}</span><button aria-label={tr("Volgende melding")} disabled={page===notifications.length-1} onClick={()=>setPage(p=>p+1)}>→</button></footer></div></dialog></>;
}
