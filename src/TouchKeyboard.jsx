import React,{useEffect,useRef,useState} from 'react';
import {Modal} from './Modal.jsx';
import {Icon} from './Icon.jsx';
import {tr} from '../shared/i18n.js';

/** Entry, focus and editing belong to the appliance, including secret fields. */
export function TouchKeyboard({label,value,onChange,onClose,type='text',numeric=false,maxLength=2048}) {
 const [shift,setShift]=useState(false),[symbols,setSymbols]=useState(false),input=useRef(null);
 useEffect(()=>{input.current?.focus({preventScroll:true});},[]);
 const secret=type==='password';
 const insert=key=>{
  const text=String(value||''),start=input.current?.selectionStart??text.length,end=input.current?.selectionEnd??text.length;
  const next=key==='Backspace'?text.slice(0,Math.max(0,start-(start===end?1:0)))+text.slice(end):text.slice(0,start)+key+text.slice(end);
  if(next.length>maxLength)return;
  onChange(next);
  const caret=key==='Backspace'?Math.max(0,start-(start===end?1:0)):start+key.length;
  requestAnimationFrame(()=>{input.current?.focus({preventScroll:true});input.current?.setSelectionRange(caret,caret);});
 };
 const rows=numeric?['123','456','789','0']:symbols?['1234567890','@#€%&*()-_','.:/\\+!?=;','[]{}<>"\'']:['1234567890','qwertyuiop','asdfghjkl','zxcvbnm'];
 return <Modal label="Touch keyboard" onCancel={onClose} className="touch-keyboard fullscreen-keyboard">
  <header><h2>{tr(label)}</h2><button type="button" aria-label={tr('Done typing')} onClick={onClose}><Icon name="check"/>{tr('Done typing')}</button></header>
  <div className="keyboard-entry"><input ref={input} aria-label={tr('Keyboard entry')} value={value??''} type="text" data-private={secret||undefined} style={secret?{WebkitTextSecurity:'disc'}:undefined} inputMode="none" autoComplete="off" autoCorrect="off" spellCheck={false} maxLength={maxLength} onChange={e=>onChange(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();onClose();}}}/><button type="button" onClick={()=>onChange('')}>{tr('Clear')}</button></div>
  <div className={'keyboard-keys '+(numeric?'numeric-keys':'')}>{rows.map((row,i)=><div className="keyboard-row" key={i}>{[...row].map(key=><button type="button" key={key} aria-label={tr(`Key ${key}`)} onPointerDown={e=>e.preventDefault()} onClick={()=>{insert(shift?key.toUpperCase():key);if(shift)setShift(false);}}>{shift?key.toUpperCase():key}</button>)}</div>)}
  <div className="keyboard-row">{!numeric&&<><button type="button" aria-label={tr('Shift')} aria-pressed={shift} onClick={()=>setShift(v=>!v)}>⇧</button><button type="button" aria-pressed={symbols} onClick={()=>setSymbols(v=>!v)}>{symbols?'ABC':'#+='}</button><button type="button" className="keyboard-space" onPointerDown={e=>e.preventDefault()} onClick={()=>insert(' ')}>{tr('Space')}</button></>}<button type="button" aria-label={tr('Backspace')} onPointerDown={e=>e.preventDefault()} onClick={()=>insert('Backspace')}>⌫</button></div></div>
 </Modal>;
}
export function KeyboardField({label,value,onChange,type='text',numeric=false,keyboard=true,autoOpen=false,...rest}) {
 const [open,setOpen]=useState(false),field=useRef(null);
 const phone=new URLSearchParams(location.search).get('setup')==='phone';
 useEffect(()=>{if(autoOpen&&keyboard&&!phone)setOpen(true);},[autoOpen,keyboard,phone]);
 const secret=type==='password';
 return <><label className="touch-field">{tr(label)}<input {...rest} ref={field} type={secret?'text':type} data-private={secret||undefined} style={secret?{WebkitTextSecurity:'disc'}:undefined} autoComplete="off" autoCorrect="off" spellCheck={false} value={value??''} aria-label={tr(label)} inputMode={keyboard&&!phone?'none':numeric?'numeric':undefined} onFocus={()=>{if(keyboard&&!phone)setOpen(true);}} onClick={()=>{if(keyboard&&!phone)setOpen(true);}} onChange={e=>onChange(e.target.value)}/></label>{open&&<TouchKeyboard label={label} type={type} numeric={numeric} value={value} onChange={onChange} maxLength={rest.maxLength} onClose={()=>{setOpen(false);field.current?.blur();}}/>}</>;
}
