import React,{useRef,useState} from 'react';
import {tr} from '../shared/i18n.js';
const time=n=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
/** Preview during drag, commit the final seek once. Metadata updates cannot fight it. */
export function SeekControl({position,duration,disabled,onSeek}) {
 const [draft,setDraft]=useState(null),drag=useRef(false);
 const shown=draft??position;
 const commit=value=>{drag.current=false;setDraft(null);if(!disabled)onSeek(Number(value));};
 return <div className="seek-control"><input aria-label={tr('Afspeelpositie')} type="range" min={0} max={duration||1} step={1} value={duration?shown:0} disabled={disabled} onPointerDown={()=>{drag.current=true;}} onChange={e=>{setDraft(Number(e.target.value));if(!drag.current)commit(e.target.value);}} onPointerUp={e=>{if(drag.current)commit(e.currentTarget.value);}} onPointerCancel={()=>{drag.current=false;setDraft(null);}}/><div className="m2-times"><span>{time(Math.max(0,shown||0))}</span><span>{Number.isFinite(duration)?time(duration):tr('Live')}</span></div></div>;
}
