import React,{useEffect,useRef,useState} from 'react';
import {tr,translateFormat} from '../shared/i18n.js';
import {Icon} from './Icon.jsx';
import {widgetCatalog,nowPlayingWidget,widgetDemo,widgetText} from '../shared/now-playing.js';

export const widgetNames={clock:'Clock',upnext:'Up next',source:'Source & quality',rooms:'Rooms',temperature:'Temperature',wifi:'Wi-Fi',power:'Power',party:'Party mode',light:'Ambient light',sunset:'Sunset'};
/** A tile as it would look now: the real reading, or an example value marked "Demo" when nothing is measured. */
export function widgetPreview(id,snapshot){
 const live=nowPlayingWidget(id,snapshot||{},{now:Date.now(),powerNow:Date.now()});
 if(live?.available)return {...live,demo:false};
 const demo=widgetDemo[id]||{value:'—'};
 return {...(live||{id,label:widgetNames[id],icon:'status'}),...demo,available:true,demo:true};
}
function Tile({id,snapshot,compact=false}){
 const tile=widgetPreview(id,snapshot);
 return <span className="we-tile" data-demo={tile.demo} data-compact={compact}>
  <Icon name={tile.icon||'status'} size={compact?20:24}/>
  <span className="we-tile-text"><small>{tr(widgetNames[id]||tile.label)}</small><strong>{widgetText(tile.value,tile.params,tr)}</strong>{tile.detail&&!compact&&<em>{widgetText(tile.detail,tile.params,tr)}</em>}</span>
  {tile.demo&&<i className="we-demo">{tr('Demo')}</i>}
 </span>;
}
/**
 * Drag a widget from the shelf onto a place, drag places to swap them, or drag one back to the shelf to remove it.
 * Every action also has a button (tap a shelf widget to add it to the first free place), so it works without dragging.
 */
export function WidgetEditor({title,ids,limit,onChange,snapshot,hint}){
 const root=useRef(null),[drag,setDrag]=useState(null),[over,setOver]=useState(null);
 const free=widgetCatalog.filter(id=>!ids.includes(id));
 // Dropping on a place: a placed widget swaps with what is there; a shelf widget replaces it (which returns to the shelf).
 const place=(id,index)=>{const from=ids.indexOf(id),next=[...ids];
  if(from>=0){if(index<ids.length){next[from]=ids[index];next[index]=id;}else{next.splice(from,1);next.push(id);}}
  else if(index<ids.length)next[index]=id;
  else if(ids.length<limit)next.push(id);
  onChange(next.slice(0,limit));};
 const remove=id=>onChange(ids.filter(x=>x!==id));
 const add=id=>{if(ids.length<limit)onChange([...ids,id]);};
 const targetAt=(x,y)=>{const el=document.elementFromPoint(x,y)?.closest?.('[data-we-target]');return el&&root.current?.contains(el)?el.dataset.weTarget:null;};
 function start(e,id,from){
  if(e.button!==undefined&&e.button!==0)return;
 const rect=(e.currentTarget.closest('.we-placed,.we-shelf-item')||e.currentTarget).getBoundingClientRect();
  setDrag({id,from,x:e.clientX,y:e.clientY,dx:e.clientX-rect.left,dy:e.clientY-rect.top,w:rect.width,h:rect.height,moved:false,pointer:e.pointerId});
  e.currentTarget.setPointerCapture?.(e.pointerId);
 }
 function move(e){if(!drag||e.pointerId!==drag.pointer)return;const moved=drag.moved||Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8;setDrag(d=>({...d,x:e.clientX,y:e.clientY,moved}));if(moved)setOver(targetAt(e.clientX,e.clientY));}
 function end(e){
  if(!drag||e.pointerId!==drag.pointer)return;
  const target=drag.moved?targetAt(e.clientX,e.clientY):null;
  if(drag.moved){
   if(target==='shelf'&&drag.from==='slot')remove(drag.id);
   else if(target?.startsWith('slot-'))place(drag.id,Number(target.slice(5)));
  }
  setDrag(null);setOver(null);
 }
 useEffect(()=>{if(!drag)return;const cancel=()=>{setDrag(null);setOver(null);};window.addEventListener('blur',cancel);return()=>window.removeEventListener('blur',cancel);},[drag]);
 const slots=Array.from({length:limit},(_,i)=>ids[i]||null);
 return <section className="widget-editor" ref={root} aria-label={tr(title)} data-dragging={!!drag?.moved} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>{setDrag(null);setOver(null);}}>
  <h4>{tr(title)}</h4>
  {hint&&<p className="we-hint">{tr(hint)}</p>}
  <ol className="we-slots" data-count={limit}>
   {slots.map((id,i)=><li key={i} data-we-target={'slot-'+i} data-over={over==='slot-'+i} data-empty={!id}>
    {id?<div className="we-placed" data-dragged={drag?.moved&&drag.id===id}>
      <button type="button" className="we-grip" aria-label={tr('Drag widget')+': '+tr(widgetNames[id])} onPointerDown={e=>start(e,id,'slot')}><span aria-hidden="true">⠿</span></button>
      <Tile id={id} snapshot={snapshot}/>
      <span className="we-actions">
       <button type="button" aria-label={tr('Move left')+': '+tr(widgetNames[id])} disabled={i===0} onPointerDown={e=>e.stopPropagation()} onClick={()=>{const n=[...ids];[n[i-1],n[i]]=[n[i],n[i-1]];onChange(n);}}><Icon name="back" size={16}/></button>
       <button type="button" aria-label={tr('Remove')+': '+tr(widgetNames[id])} onPointerDown={e=>e.stopPropagation()} onClick={()=>remove(id)}><Icon name="close" size={16}/></button>
       <button type="button" aria-label={tr('Move right')+': '+tr(widgetNames[id])} disabled={i>=ids.length-1} onPointerDown={e=>e.stopPropagation()} onClick={()=>{const n=[...ids];[n[i+1],n[i]]=[n[i],n[i+1]];onChange(n);}}><Icon name="back" size={16} className="np-flip"/></button>
      </span>
     </div>:<span className="we-empty">{tr(drag?.moved?'Drop here':'Empty place')}</span>}
   </li>)}
  </ol>
  <div className="we-shelf" data-we-target="shelf" data-over={over==='shelf'}>
   <small>{tr(free.length?(ids.length>=limit?'All places are full: drag a widget back here or remove one first.':'Tap a widget to add it, or drag its grip to a place.'):'Every widget is in use.')}</small>
   <div className="we-shelf-items">{free.map(id=><div key={id} className="we-shelf-item" data-dragged={drag?.moved&&drag.id===id}><button type="button" className="we-add" aria-label={translateFormat('Add {name}',{name:tr(widgetNames[id])})} disabled={ids.length>=limit} onClick={()=>add(id)}><Tile id={id} snapshot={snapshot} compact/></button><button type="button" className="we-grip" aria-label={tr('Drag widget')+': '+tr(widgetNames[id])} onPointerDown={e=>start(e,id,'shelf')}><span aria-hidden="true">⠿</span></button></div>)}</div>
  </div>
  {drag?.moved&&<div className="we-ghost" aria-hidden="true" style={{left:drag.x-drag.dx,top:drag.y-drag.dy,width:drag.w}}><Tile id={drag.id} snapshot={snapshot}/></div>}
 </section>;
}
