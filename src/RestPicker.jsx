import {tr,translateFormat} from "../shared/i18n.js";
import React,{useState} from 'react';
import {Icon} from './Icon.jsx';
import {sleepModes,restBackgrounds,backgroundModes,screenSettings} from '../shared/wall.js';
import {restBackdrop,RestBackdrop} from './RestBackdrop.jsx';
import {useDeviceUpdates} from './DeviceUpdates.jsx';

export const restModeNames={clock:'Clock and date',widgets:'Widgets',sunset:'Sunset',glow:'Glow',playing:'Now Playing',black:'Black · backlight off',vu:'Stereo VU',bars:'Stereo bars',spectrum:'Spectrum'};
const restModeHints={clock:'Large time and date',widgets:'Time with temperature, light and sunset',sunset:'Time and today’s sunset',glow:'A soft glow in your theme colour',playing:'The current song',black:'Backlight off; touch wakes it',vu:'Moving stereo needles',bars:'Stereo level bars',spectrum:'Live frequency bars'};
const backgroundNames={black:'Black',art:'Album art, blurred',gradient:'Colour gradient',fjord:'Fjord',lake:'Lake',pines:'Pines',own:'Your own photo'};
const bars=[.5,.8,.62,.95,.7,.45,.58,.36,.22];
/** A miniature of what the rest view looks like, so the choice is clear before you pick it. */
export function RestPreview({mode,backdrop}){
 return <span className="rest-mini" data-mode={mode} aria-hidden="true">
  <RestBackdrop backdrop={backdrop}/>
  {['clock','widgets','sunset'].includes(mode)&&<><span className="rest-mini-time">20:42</span><span className="rest-mini-date">{tr('Sunday 22 November')}</span></>}
  {mode==='widgets'&&<span className="rest-mini-pills"><em/><em/><em/></span>}
  {mode==='sunset'&&<span className="rest-mini-sun"><Icon name="sunset" size={14}/>16:41</span>}
  {mode==='glow'&&<span className="rest-mini-glow"/>}
  {mode==='playing'&&<span className="rest-mini-song"><em/><span><strong/><small/></span></span>}
  {mode==='black'&&<Icon name="moon" size={22}/>}
  {mode==='vu'&&<span className="rest-mini-vu">{[0,1].map(i=><svg key={i} viewBox="0 0 40 24"><path d="M4 22A18 18 0 0 1 36 22" fill="none" stroke="currentColor" strokeWidth="2"/><path d={i?'M20 22L28 8':'M20 22L13 7'} stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round"/></svg>)}</span>}
  {mode==='spectrum'&&<span className="rest-mini-spectrum">{bars.map((h,i)=><em key={i} style={{height:h*100+'%'}}/>)}</span>}
  {mode==='bars'&&<span className="rest-mini-bars"><em style={{width:'78%'}}/><em style={{width:'64%'}}/></span>}
 </span>;
}
/**
 * Rest view and background chooser with previews. `screen` is the normalized screen preference;
 * `onChange(next)` receives the whole next screen object.
 */
export function RestPicker({screen:value,onChange,snapshot}){
 const screen=screenSettings(value);
 const artwork=snapshot?.playback?.queue?.[snapshot?.playback?.index]?.artwork;
 const restPhoto=snapshot?.restPhoto;
 const set=patch=>onChange({...value,...patch});
 const backdropFor=(mode,background=screen.background)=>restBackdrop({...screen,mode,background},{artwork,restPhoto});
 return <div className="rest-picker">
  <div className="rest-tiles" role="radiogroup" aria-label={tr('Screen rest view')}>
   {sleepModes.map(mode=><button key={mode} type="button" role="radio" aria-checked={screen.mode===mode} data-mode={mode} onClick={()=>set({mode})}>
    <RestPreview mode={mode} backdrop={backdropFor(mode)}/><strong>{tr(restModeNames[mode])}</strong><small>{tr(restModeHints[mode])}</small>
   </button>)}
  </div>
  {backgroundModes.includes(screen.mode)&&<fieldset className="rest-backgrounds"><legend>{tr('Background')}</legend>
   <div className="rest-tiles rest-bg-tiles" role="radiogroup" aria-label={tr('Background')}>
    {restBackgrounds.map(bg=><button key={bg} type="button" role="radio" aria-checked={screen.background===bg} data-background={bg} onClick={()=>set({background:bg})}>
     <RestPreview mode={screen.mode} backdrop={backdropFor(screen.mode,bg)}/><strong>{tr(backgroundNames[bg])}</strong>
     {bg==='own'&&!restPhoto?.current&&<small>{tr('Send one from the phone remote')}</small>}
     {bg==='art'&&!artwork&&<small>{tr('Gradient while nothing plays')}</small>}
    </button>)}
   </div>
   <OwnPhoto restPhoto={restPhoto} active={screen.background==='own'}/>
  </fieldset>}
 </div>;
}
function OwnPhoto({restPhoto,active}){
 const device=useDeviceUpdates();const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function act(action){setBusy(true);setError('');try{const r=await fetch('/api/rest-photo',{method:'POST',headers:{'Content-Type':'application/json','X-TuneBox-Control':device?.info?.controlToken||''},body:JSON.stringify({action}),signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error((await r.json().catch(()=>({}))).error||'Could not change the photo');}catch(e){setError(e.message);}finally{setBusy(false);}}
 const pending=restPhoto?.pending;
 return <div className="rest-own" data-active={active}>
  {pending&&<div className="rest-own-pending" role="group" aria-label={tr('New photo from a phone')}>
   <img src={'/api/rest-photo/pending?v='+pending.revision} alt={tr('New photo from a phone')}/>
   <div><strong>{tr('New photo from a phone')}</strong><small>{translateFormat('Sent by {name}. It only appears on TuneBox after you accept it here.',{name:pending.from||tr('a phone')})}</small>
   <span className="rest-own-actions"><button type="button" disabled={busy} onClick={()=>act('accept')}><Icon name="check" size={20}/>{tr('Use this photo')}</button><button type="button" disabled={busy} onClick={()=>act('discard')}><Icon name="close" size={20}/>{tr('Discard')}</button></span></div>
  </div>}
  {active&&<p className="settings-note"><Icon name="phone" size={18}/> {tr('To add your own photo: open the phone remote and choose “Screen rest photo”. The phone shrinks the photo and removes its location data before sending it.')}</p>}
  {restPhoto?.current&&active&&<button type="button" className="rest-own-remove" disabled={busy} onClick={()=>act('remove')}>{tr('Remove your photo')}</button>}
  {error&&<p role="alert" className="settings-note">{tr(error)}</p>}
 </div>;
}
