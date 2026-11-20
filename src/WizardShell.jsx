import React,{useLayoutEffect,useRef} from 'react';
import {tr} from '../shared/i18n.js';
export function WizardShell({title,steps=[],step=0,busy=false,statusBusy=false,busyLabel='Working…',allowExitWhileBusy=false,notice='',onClose,onBack,onNext,nextLabel='Continue',nextDisabled=false,onSkip,children}){
 const root=useRef(null);
 useLayoutEffect(()=>{const node=root.current;node.showModal();return()=>{if(node.open)node.close();};},[]);
 return <dialog ref={root} className="first-start setup-journey" role="dialog" aria-modal="true" aria-label={tr(title)} aria-busy={busy||statusBusy} onCancel={event=>{event.preventDefault();if(!busy||allowExitWhileBusy)onClose?.();}}>
  <header><div><small>DAW TuneBox</small><h2>{tr(title)}</h2></div><button disabled={busy&&!allowExitWhileBusy} onClick={onClose}>{tr('Finish later')}</button></header>
  <ol className="journey-steps" data-steps={steps.length} aria-label={tr('Setup steps')}>{steps.map((name,i)=><li key={name} aria-current={i===step?'step':undefined}><b>{i+1}</b><span>{tr(name)}</span></li>)}</ol>
  <div className="first-start-body">{children}</div><footer><span role="status" aria-live="polite">{(busy||statusBusy)&&<span className="ui-spinner" aria-hidden="true"/>}{tr(notice||(busy||statusBusy?busyLabel:''))}</span>{onBack&&<button disabled={busy} onClick={onBack}>{tr('Back')}</button>}{onSkip&&<button disabled={busy&&!allowExitWhileBusy} onClick={onSkip}>{tr('Skip for now')}</button>}{onNext&&<button disabled={busy||nextDisabled} onClick={onNext}>{tr(nextLabel)}</button>}</footer>
 </dialog>;
}
