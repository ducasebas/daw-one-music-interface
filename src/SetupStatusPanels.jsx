import React,{useState} from 'react';
import {useDeviceUpdates} from './DeviceUpdates.jsx';
import {tr} from '../shared/i18n.js';
import {automaticDspProfiles} from '../shared/automatic-dsp.js';

export function AutomaticSoundPanel({snapshot,onOpen,offline}){
 const device=useDeviceUpdates(),status=snapshot.automaticDsp||{},[notice,setNotice]=useState('');
 return <section className="automatic-sound-summary" aria-label={tr('Automatic sound')}><h3>{tr('Automatic sound')}</h3><p>{tr(status.settings?.enabled?automaticDspProfiles[status.activeProfile]||'Automatic sound enabled':'Manual / current EQ')}</p>{status.error&&<p role="alert">{tr(status.error)}</p>}<button onClick={onOpen}>{tr('Open sound setup')}</button>{status.settings?.enabled&&<button disabled={offline||device.pending} onClick={async()=>{try{await device.action('dsp-auto-config',{settings:{...status.settings,enabled:false},confirmed:true});setNotice('Reference EQ restored. Manual controls are available.');}catch(e){setNotice(e.message);}}}>{tr('Switch to manual sound')}</button>}<p role="status">{tr(notice)}</p></section>;
}
export function SyncSetupPanel({snapshot,enabled,onEnabled,onOpen}){
 const active=snapshot.sync?.active;
 return <section className="sync-setup-summary" aria-label={tr('Automatic synchronization')}><h3>{tr('Automatic synchronization')}</h3><label className="hub-check"><input type="checkbox" checked={enabled} onChange={e=>onEnabled(e.target.checked)}/>{tr('Use saved timing for the current output')}</label><p>{tr(active?'A measured timing profile matches this output and group.':'No measured profile matches this output yet. Manual timing is used.')}</p>{active&&<p>{active.delayMs} ms · ±{active.uncertaintyMs} ms</p>}<button onClick={onOpen}>{tr('Open synchronization wizard')}</button></section>;
}
