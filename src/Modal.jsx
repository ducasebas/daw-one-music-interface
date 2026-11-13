import React,{useEffect,useRef} from 'react';
import {tr} from '../shared/i18n.js';
export function Modal({label,onCancel,className='',children}){const root=useRef(null);useEffect(()=>{root.current.showModal();},[]);return <dialog ref={root} className={'hub-confirm '+className} aria-label={tr(label)} onCancel={e=>{e.preventDefault();onCancel?.();}}>{children}</dialog>;}
