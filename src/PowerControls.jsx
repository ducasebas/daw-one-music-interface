import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useDeviceUpdates} from './DeviceUpdates.jsx';
import {Icon} from './Icon.jsx';
import {tr} from '../shared/i18n.js';

export function PowerOffButton({offline=false,label=false}){
  const updates=useDeviceUpdates(),dialog=useRef(null),trigger=useRef(null);
  const [phase,setPhase]=useState('idle'),[error,setError]=useState(''),[simulated,setSimulated]=useState(false);
  const offSurface=useRef(null),offActive=['shutting-down','dark'].includes(phase);
  const supported=updates?.info?.manager?.powerOffSupported===true;
  useEffect(()=>{if(!offActive)return;const app=document.getElementById('root'),wasInert=app?.inert;if(app)app.inert=true;offSurface.current?.focus();return()=>{if(app)app.inert=wasInert;trigger.current?.focus();};},[offActive]);
  useEffect(()=>{if(phase!=='shutting-down')return;const timer=setTimeout(()=>setPhase('dark'),3500);return()=>clearTimeout(timer);},[phase]);
  async function powerOff(){
    setError('');setPhase('sending');
    try{
      const result=await updates.action('power-off',{confirmed:true});
      setSimulated(result.simulated===true);dialog.current.close();setPhase('shutting-down');
    }catch(e){setError(e.message);setPhase('idle');}
  }
  return <>
    <button ref={trigger} className={label?'system-power-button':undefined} aria-label={tr('Power off TuneBox')} onClick={()=>{setError('');updates?.refresh();dialog.current.showModal();}}><Icon name="power" size={24}/>{label&&tr('Power off TuneBox')}</button>
    <dialog ref={dialog} className="power-dialog" aria-label={tr('Power off TuneBox')} onClose={()=>trigger.current?.focus()} onCancel={event=>{if(phase==='sending')event.preventDefault();}}>
      <Icon name="power" size={44}/><h2>{tr('Power off TuneBox?')}</h2>
      <p>{tr('Stop audio on this TuneBox, turn off the display and shut down the Raspberry Pi.')}</p>
      <p>{tr('To start again, reconnect power or use a supported hardware power button. Software shutdown does not disconnect the power supply; its LED may stay on.')}</p>
      {updates?.info?.manager?.simulated&&<p>{tr('Simulation — no device will be shut down.')}</p>}
      {!supported&&<p role="status">{tr('Power off requires the updated device manager on the Pi.')}</p>}
      {error&&<p role="alert">{tr(error)}</p>}
      <div className="power-actions"><button autoFocus disabled={phase==='sending'} onClick={()=>dialog.current.close()}>{tr('Cancel')}</button><button disabled={!supported||offline||updates?.info?.offline||updates?.pending||phase==='sending'} onClick={powerOff}>{tr(phase==='sending'?'Shutting down…':'Power off')}</button></div>
    </dialog>
    {offActive&&createPortal(<div ref={offSurface} tabIndex={-1} className="power-off-surface" role="status" aria-label={tr('Power off in progress')}>
      {phase==='shutting-down'&&<><Icon name="power" size={48}/><p>{tr('Shutting down…')}</p></>}
      {simulated&&<button onClick={()=>setPhase('idle')}>{tr('Return to simulation')}</button>}
    </div>,document.body)}
  </>;
}
