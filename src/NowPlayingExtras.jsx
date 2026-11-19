import React,{useEffect,useRef,useState} from 'react';
import {tr} from '../shared/i18n.js';
import {Icon} from './Icon.jsx';
import {backdropSource,nowPlayingWidgets,widgetSelection,widgetText} from '../shared/now-playing.js';

/** Blurred, enlarged, darkened artwork behind Now Playing. The new cover fades in over the
 * old one once it has loaded, so a slow image never leaves a blank or flashing background.
 * Only transform/opacity animate; the blur is computed on a small layer and scaled up. */
export function NowPlayingBackdrop({snapshot,prefs,offline}){
 const {mode,src,key}=backdropSource({snapshot,prefs,offline});
 const [layers,setLayers]=useState(()=>src&&mode==='live'?[{key,src}]:[]);
 const generation=useRef(0);
 useEffect(()=>{
  if(mode!=='live')return;
  const own=++generation.current;
  if(!src){setLayers(old=>old.length?[]:old);return;}
  let image=new Image();
  image.onload=()=>{if(own!==generation.current)return;setLayers(old=>old.at(-1)?.src===src?old:[...old.slice(-1),{key,src}]);};
  image.onerror=()=>{if(own===generation.current)setLayers([]);};
  image.src=src;
  return()=>{image.onload=image.onerror=null;image=null;};
 },[src,mode]);
 if(mode==='off')return null;
 return <div className="np-backdrop" data-mode={mode} data-artwork={layers.length?'true':'false'} aria-hidden="true">
  {mode==='live'&&layers.map((layer,i)=><div key={layer.key} className="np-backdrop-layer" data-current={i===layers.length-1} style={{backgroundImage:`url("${layer.src.replace(/["\\]/g,'')}")`}} onAnimationEnd={()=>{if(i===layers.length-1)setLayers(old=>old.slice(-1));}}/>)}
 </div>;
}

function useNetworkReading(enabled){
 const [value,setValue]=useState(null);
 useEffect(()=>{if(!enabled)return;let live=true;const controller=new AbortController();
  const read=()=>fetch('/api/network',{signal:controller.signal}).then(r=>r.ok?r.json():null).then(v=>{if(live)setValue(v);}).catch(()=>{});
  read();const timer=setInterval(read,30000);return()=>{live=false;clearInterval(timer);controller.abort();};},[enabled]);
 return value;
}
function useMinuteClock(enabled){
 const [now,setNow]=useState(Date.now);
 useEffect(()=>{if(!enabled)return;let timer;const tick=()=>{setNow(Date.now());timer=setTimeout(tick,60000-Date.now()%60000+50);};tick();return()=>clearTimeout(timer);},[enabled]);
 return now;
}
/** Compact tiles chosen in Settings → Display. Tiles with somewhere to go are buttons. */
export function NowPlayingWidgets({snapshot,prefs,offline,onOpen}){
 const ids=widgetSelection(prefs.widgets);
 const network=useNetworkReading(!offline&&ids.includes('wifi'));
 const now=useMinuteClock(ids.includes('clock')||ids.includes('power'));
 const tiles=nowPlayingWidgets(ids,snapshot,{now,offline,network,hour12:snapshot.preferences?.clock?.hour12===true});
 if(!tiles.length)return null;
 return <section className="np-widgets" aria-label={tr('Now Playing widgets')} data-count={tiles.length}>
  {tiles.map(tile=>{const body=<><Icon name={tile.icon} size={26}/><span className="np-widget-text"><small>{tr(tile.label)}</small><strong>{widgetText(tile.value,tile.params,tr)}</strong>{tile.detail&&<em>{widgetText(tile.detail,tile.params,tr)}</em>}</span></>;
   return tile.action?<button key={tile.id} className="np-widget" data-widget={tile.id} data-available={tile.available} onClick={()=>onOpen?.(tile.action)}>{body}</button>:<article key={tile.id} className="np-widget" data-widget={tile.id} data-available={tile.available}>{body}</article>;})}
 </section>;
}
