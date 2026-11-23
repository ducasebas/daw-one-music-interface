import React,{useState} from 'react';
import {tr} from '../shared/i18n.js';
import {Sheet} from './Sheet.jsx';
import {WidgetEditor,widgetNames} from './WidgetEditor.jsx';
import {Icon} from './Icon.jsx';

/** Keep drag controls out of the Settings scroll surface. Apply stages a draft; Settings Save persists it. */
export function WidgetChooser({title,ids,limit,onChange,snapshot,hint}){
 const [draft,setDraft]=useState(null);
 const cancel=()=>setDraft(null);
 return <section className="widget-chooser-entry" aria-label={tr(title)}>
  <div><h4>{tr(title)}</h4><p>{ids.length?ids.map(id=>tr(widgetNames[id])).join(' · '):tr('No widgets selected')}</p></div>
  <button type="button" aria-haspopup="dialog" aria-label={tr('Choose widgets')+': '+tr(title)} onClick={()=>setDraft([...ids])}>{tr('Choose widgets')}<Icon name="next" size={22}/></button>
  {draft!==null&&<Sheet label={title} className="widget-chooser" onCancel={cancel}>
   <header><small>DAW TuneBox</small><h2>{tr(title)}</h2><p>{tr('Tap to add a widget. Use the grip to drag; swipe elsewhere to scroll.')}</p></header>
   <div className="tb-sheet-body"><WidgetEditor title={title} ids={draft} limit={limit} onChange={setDraft} snapshot={snapshot} hint={hint}/></div>
   <footer><span role="status">{tr('Apply your selection, then Save in Settings to keep it.')}</span><button type="button" onClick={cancel}>{tr('Cancel')}</button><button type="button" className="tb-sheet-primary" onClick={()=>{onChange([...draft]);cancel();}}>{tr('Apply selection')}</button></footer>
  </Sheet>}
 </section>;
}
