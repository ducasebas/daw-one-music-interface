import React,{useEffect,useRef} from 'react';
import {tr} from '../shared/i18n.js';
/** Full-screen sheet in the shared popup style (src/sheets.css): a top-layer dialog over the blurred interface. */
export function Sheet({label,className='',onCancel,children}){
 const root=useRef(null);
 useEffect(()=>{const node=root.current;if(!node.open)node.showModal();return()=>{if(node.open)node.close();};},[]);
 return <dialog ref={root} className={'tb-sheet '+className} aria-label={tr(label)} onCancel={e=>{e.preventDefault();onCancel?.();}}>{children}</dialog>;
}
