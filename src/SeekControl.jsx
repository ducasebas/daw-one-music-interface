import React,{useRef,useState,useEffect} from 'react';
import {tr} from '../shared/i18n.js';
import {positionAt} from '../shared/playback.js';
/** Only this small control ticks; menus, artwork and the shell do not. */
export function PlaybackSeekControl({playback,...props}){
 const [now,setNow]=useState(Date.now);
 useEffect(()=>{
  let timer;
  const visible=()=>{
   clearInterval(timer);
   setNow(Date.now());
   if(playback.playing&&!document.hidden)timer=setInterval(()=>setNow(Date.now()),250);
  };
  visible();document.addEventListener('visibilitychange',visible);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[playback.playing]);
 const position=positionAt(playback,Math.max(now,playback.observedAt||0));
 return <SeekControl {...props} position={position}/>;
}
const time=n=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
/** Where on the bar a pointer is, as a position in seconds (whole seconds, clamped). */
export function seekValueAt(clientX,rect,duration,inset=0){
 const width=Math.max(1,rect.width-2*inset);
 const along=Math.max(0,Math.min(1,(clientX-rect.left-inset)/width));
 return Math.round(along*Math.max(0,duration||0));
}
/** Preview during drag, commit the final seek once on release. Metadata updates cannot fight it:
 * after release the chosen position stays on screen until playback reports it (or 3 s pass). */
export function SeekControl({position,duration,disabled,onSeek}) {
 const [draft,setDraft]=useState(null),[dragging,setDragging]=useState(false),drag=useRef(null),held=useRef(null);
 useEffect(()=>()=>clearTimeout(held.current?.timer),[]);
 useEffect(()=>{const h=held.current;if(h&&Math.abs((position??0)-h.value)<=2&&!drag.current){clearTimeout(h.timer);held.current=null;setDraft(null);}},[position]);
 useEffect(()=>{if(disabled){drag.current=null;setDragging(false);setDraft(null);}},[disabled]);
 const shown=draft??position;
 const commit=value=>{
  drag.current=null;setDragging(false);
  if(disabled||!Number.isFinite(value)){setDraft(null);return;}
  clearTimeout(held.current?.timer);
  held.current={value,timer:setTimeout(()=>{held.current=null;setDraft(null);},3000)};
  setDraft(value);onSeek(Number(value));
 };
 const at=(e)=>seekValueAt(e.clientX,e.currentTarget.getBoundingClientRect(),duration,10);
 return <div className="seek-control" data-dragging={dragging||undefined}><input aria-label={tr('Afspeelpositie')} type="range" min={0} max={duration||1} step={1} value={duration?Math.max(0,Math.min(duration,shown||0)):0} disabled={disabled}
  onPointerDown={e=>{if(disabled||!duration||e.button>0)return;e.preventDefault();e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture?.(e.pointerId);drag.current={id:e.pointerId};setDragging(true);setDraft(at(e));}}
  onPointerMove={e=>{if(drag.current?.id!==e.pointerId)return;setDraft(at(e));}}
  onPointerUp={e=>{if(drag.current?.id!==e.pointerId)return;commit(at(e));}}
  onPointerCancel={e=>{if(drag.current?.id!==e.pointerId)return;drag.current=null;setDragging(false);setDraft(null);}}
  onLostPointerCapture={e=>{if(drag.current?.id===e.pointerId){drag.current=null;setDragging(false);setDraft(null);}}}
  onChange={e=>{if(drag.current)return;commit(Number(e.target.value));}}/><div className="m2-times"><span>{time(Math.max(0,shown||0))}</span><span>{Number.isFinite(duration)?time(duration):tr('Live')}</span></div></div>;
}
