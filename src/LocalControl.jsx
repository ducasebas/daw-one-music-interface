import React,{useState} from 'react';
import {tr,translateFormat} from '../shared/i18n.js';
import {Icon} from './Icon.jsx';

/** GUI 3.13 OFFLINE: when Music Assistant is unreachable, this TuneBox's own amplifier can
 * still pause and change volume (never above the level when local control began). */
export function LocalControl({snapshot,token}){
 const local=snapshot.localControl,[busy,setBusy]=useState(''),[error,setError]=useState('');
 if(!local||!(local.needed||local.lowered||local.standby))return null;
 const send=async action=>{if(busy)return;setBusy(action);setError('');
  try{const r=await fetch('/api/local',{method:'POST',headers:{'Content-Type':'application/json','X-TuneBox-Control':token||''},body:JSON.stringify({action})});const v=await r.json().catch(()=>({}));if(!r.ok)throw Error(v.error||'Local control failed');}
  catch(e){setError(e.message);}finally{setBusy('');}};
 const away=local.needed;
 return <section className="local-control" aria-label={tr('Local control')} data-away={away||undefined}>
  <div className="local-control-text"><strong>{tr(away?'Music Assistant is unavailable':'Local amplifier settings are active')}</strong>
   <span>{tr(away?'Pause and volume still work on this TuneBox. Other rooms and the queue are not changed.':local.standby?'The amplifier is paused locally.':'The local volume is lower than before. Restore it when you are ready.')}</span></div>
  <div className="local-control-actions">
   <button disabled={!!busy} aria-pressed={local.standby} onClick={()=>send(local.standby?'resume':'pause')}><Icon name={local.standby?'play':'pause'} size={22}/>{tr(local.standby?'Resume locally':'Pause locally')}</button>
   {away&&<><button disabled={!!busy||local.standby||local.level<=0} onClick={()=>send('quieter')} aria-label={tr('Quieter')}>−</button>
   <output aria-label={tr('Local volume')}>{translateFormat('{level}%',{level:local.level})}</output>
   <button disabled={!!busy||local.standby||local.level>=100} onClick={()=>send('louder')} aria-label={tr('Louder, up to the previous level')}>+</button></>}
   {!away&&local.lowered&&<button disabled={!!busy} onClick={()=>send('restore')}>{tr('Restore local volume')}</button>}
  </div>
  {error&&<p role="alert">{tr(error)}</p>}
 </section>;
}
