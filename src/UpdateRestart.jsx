import React,{useEffect,useState,useRef} from 'react';
import {Modal} from './Modal.jsx';
import {tr} from '../shared/i18n.js';
export function UpdateRestart({info}){
 const [dismissed,setDismissed]=useState(null);
 const job=info?.restart,[error,setError]=useState(''),[seconds,setSeconds]=useState(10),started=useRef(null),warning=useRef(null);
 const active=['waiting','await-screen','countdown','rebooting','required'].includes(job?.phase)&&job.commit===info?.current?.commit;
 useEffect(()=>{
  if(!active||job.phase!=='await-screen'||!info.controlToken)return;let live=true;
  // The new exact build must actually paint its own warning before the helper can reboot.
  const timer=setTimeout(async()=>{const dialog=warning.current?.closest('dialog');if(document.hidden||!dialog?.open||!dialog.contains(document.activeElement))return;try{const r=await fetch('/api/updates/reboot-ready',{method:'POST',headers:{'Content-Type':'application/json','X-TuneBox-Control':info.controlToken},body:JSON.stringify({commit:job.commit,release:job.release}),signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();}catch{if(live)setError('Restart could not be confirmed. Use Restart in System settings when ready.');}},1000);
  return()=>{live=false;clearTimeout(timer);};
 },[active,job?.phase,job?.commit,info?.controlToken]);
 useEffect(()=>{if(job?.phase!=='countdown'){started.current=null;return;}if(Number.isFinite(job.remainingSeconds))started.current={at:performance.now(),seconds:job.remainingSeconds};else started.current??={at:performance.now(),seconds:10};const tick=()=>setSeconds(Math.max(0,Math.ceil(started.current.seconds-(performance.now()-started.current.at)/1000)));tick();const t=setInterval(tick,250);return()=>clearInterval(t);},[job?.phase,job?.remainingSeconds]);
 if(!active||dismissed===job.commit)return null;
 return <Modal label="Update installed" onCancel={()=>{if(job.phase==='required')setDismissed(job.commit);}}><div ref={warning} role="status" className="restart-status"><span className="ui-spinner" aria-hidden="true"/><h3>{tr(job.phase==='required'?'Restart needed':job.phase==='rebooting'?'TuneBox is restarting…':'TuneBox will restart shortly')}</h3><p>{tr('The update passed its startup check. Your settings are saved. Music stays paused after restart.')}</p>{job.phase==='countdown'&&<p>{seconds} {tr('seconds')}</p>}<p>{tr(job.phase==='required'?'Open System settings and choose Restart when ready.':'Keep the power connected. The screen will return automatically.')}</p>{error&&<p role="alert">{tr(error)}</p>}</div>{job.phase==='required'&&<button onClick={()=>setDismissed(job.commit)}>{tr('Back to TuneBox')}</button>}</Modal>;
}
