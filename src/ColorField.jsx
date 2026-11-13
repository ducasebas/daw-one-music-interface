import React,{useState} from 'react';
import {Modal} from './Modal.jsx';
import {tr} from '../shared/i18n.js';
export function ColorField({label,value,onChange}) {
 const [draft,setDraft]=useState(null);
 const channels=draft?[1,3,5].map(i=>parseInt(draft.slice(i,i+2),16)):[];
 return <div className="color-field"><span>{tr(label)}</span><button type="button" aria-label={tr(label)} style={{borderColor:value}} onClick={()=>setDraft(value)}><i style={{background:value}}/>{value}</button>{draft&&<Modal label={label} className="color-picker" onCancel={()=>setDraft(null)}><h2>{tr(label)}</h2><div className="color-preview" style={{background:draft}}/><div className="color-swatches">{['#c8a56c','#f1eee6','#151a1d','#68b3a0','#83a7d8','#cb7770','#d7c889','#a194c2'].map(color=><button type="button" key={color} aria-label={color} style={{background:color}} onClick={()=>setDraft(color)}/>)}</div>{channels.map((v,i)=><label key={i}>{['R','G','B'][i]}<input type="range" min="0" max="255" value={v} onChange={e=>setDraft('#'+channels.map((n,j)=>(j===i?Number(e.target.value):n).toString(16).padStart(2,'0')).join(''))}/><output>{v}</output></label>)}<div><button onClick={()=>setDraft(null)}>{tr('Cancel')}</button><button onClick={()=>{onChange(draft);setDraft(null);}}>{tr('Apply color')}</button></div></Modal>}</div>;
}
