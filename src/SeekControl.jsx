import React,{useRef,useState,useEffect,useLayoutEffect,useCallback,useImperativeHandle} from 'react';
import {tr} from '../shared/i18n.js';
import {positionAt} from '../shared/playback.js';
/** Paint only the native range and elapsed label; a playing clock never commits React frames. */
export function PlaybackSeekControl({playback,active=true,...props}){
 const playhead=useRef(null);
 useEffect(()=>{
  let frame,timer,last=0;
  // Monotonic elapsed time keeps a clock correction from jumping a playing bar.
  const wall=Date.now(),anchor=performance.now();
  const paint=now=>playhead.current?.paint(positionAt(playback,Math.max(now,playback.observedAt||0)));
  const tick=time=>{if(time-last>=32){last=time;paint(wall+time-anchor);}frame=requestAnimationFrame(tick);};
  const visible=()=>{cancelAnimationFrame(frame);clearInterval(timer);paint(wall+performance.now()-anchor);if(active&&playback.playing&&!document.hidden){if(Number.isFinite(props.duration)&&props.duration>0)frame=requestAnimationFrame(tick);else timer=setInterval(()=>paint(wall+performance.now()-anchor),1000);}};
  visible();document.addEventListener('visibilitychange',visible);
  return()=>{cancelAnimationFrame(frame);clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[active,playback.playing,playback.position,playback.observedAt,props.duration]);
 const position=positionAt(playback,Math.max(Date.now(),playback.observedAt||0));
 return <SeekControl {...props} position={position} playheadRef={playhead}/>;
}
const time=n=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
/** Where on the bar a pointer is, as a position in seconds (whole seconds, clamped). */
export function seekValueAt(clientX,rect,duration,inset=0){
 const width=Math.max(1,rect.width-2*inset);
 const along=Math.max(0,Math.min(1,(clientX-rect.left-inset)/width));
 const maximum=Math.max(0,duration||0);return Math.min(maximum,Math.round(along*maximum));
}
/** Preview during drag, commit the final seek once on release. Metadata updates cannot fight it:
 * after release the chosen position stays on screen until playback reports it (or 3 s pass). */
export function SeekControl({position,duration,disabled,onSeek,playheadRef}) {
 const [draft,setDraft]=useState(null),[dragging,setDragging]=useState(false),drag=useRef(null),held=useRef(null);
 const input=useRef(null),elapsed=useRef(null),livePosition=useRef(position);
 const paint=useCallback(value=>{
  livePosition.current=value;
  const h=held.current;
  if(h&&Math.abs((value??0)-h.value)<=2&&!drag.current){clearTimeout(h.timer);held.current=null;setDraft(null);}
  const shown=drag.current?.value??held.current?.value??value;
  const seconds=Math.max(0,shown||0),bounded=duration?Math.min(duration,seconds):0;
  const percent=`${duration?Math.max(0,Math.min(100,100*bounded/duration)):0}%`,label=time(seconds);
  if(input.current){
   if(Number(input.current.value)!==bounded)input.current.value=String(bounded);
   if(input.current.style.getPropertyValue('--seek-position')!==percent)input.current.style.setProperty('--seek-position',percent);
   if(input.current.getAttribute('aria-valuetext')!==label)input.current.setAttribute('aria-valuetext',label);
  }
  if(elapsed.current&&elapsed.current.textContent!==label)elapsed.current.textContent=label;
 },[duration]);
 useImperativeHandle(playheadRef,()=>({paint}),[paint]);
 useLayoutEffect(()=>paint(position),[position,paint]);
 useEffect(()=>()=>clearTimeout(held.current?.timer),[]);
 useEffect(()=>{const h=held.current;if(h&&Math.abs((position??0)-h.value)<=2&&!drag.current){clearTimeout(h.timer);held.current=null;setDraft(null);}},[position]);
 useEffect(()=>{if(disabled){drag.current=null;clearTimeout(held.current?.timer);held.current=null;setDragging(false);setDraft(null);}},[disabled]);
 const shown=draft??livePosition.current;
 const commit=value=>{
  drag.current=null;setDragging(false);
  if(disabled||!Number.isFinite(value)){setDraft(null);return;}
  clearTimeout(held.current?.timer);
  held.current={value,timer:setTimeout(()=>{held.current=null;setDraft(null);},3000)};
  setDraft(value);onSeek(Number(value));
 };
 const at=(e)=>seekValueAt(e.clientX,e.currentTarget.getBoundingClientRect(),duration,12);
 return <div className="seek-control" data-dragging={dragging||undefined}><input ref={input} style={{'--seek-position':`${duration?Math.max(0,Math.min(100,100*(shown||0)/duration)):0}%`}} aria-label={tr('Afspeelpositie')} aria-valuetext={time(Math.max(0,shown||0))} type="range" min={0} max={duration||1} step={0.01} value={duration?Math.max(0,Math.min(duration,shown||0)):0} disabled={disabled}
  onPointerDown={e=>{if(disabled||!duration||e.button>0)return;e.preventDefault();e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture?.(e.pointerId);drag.current={id:e.pointerId,value:at(e)};setDragging(true);setDraft(drag.current.value);}}
  onPointerMove={e=>{if(drag.current?.id!==e.pointerId)return;drag.current.value=at(e);setDraft(drag.current.value);}}
  onPointerUp={e=>{if(drag.current?.id!==e.pointerId)return;commit(at(e));}}
  onPointerCancel={e=>{if(drag.current?.id!==e.pointerId)return;drag.current=null;setDragging(false);setDraft(null);}}
  onLostPointerCapture={e=>{if(drag.current?.id===e.pointerId){drag.current=null;setDragging(false);setDraft(null);}}}
  onChange={e=>{if(drag.current)return;commit(Number(e.target.value));}}/><div className="m2-times"><span ref={elapsed}>{time(Math.max(0,shown||0))}</span><span>{Number.isFinite(duration)?time(duration):tr('Live')}</span></div></div>;
}
