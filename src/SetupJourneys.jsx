import React,{lazy,Suspense} from 'react';
import './wizards.css';
import {setupJourneys,setupConnectionStatus} from '../shared/setup-journeys.js';
import {tr} from '../shared/i18n.js';
import {Icon} from './Icon.jsx';
import {WizardShell} from './WizardShell.jsx';
import {NetworkWizard} from './NetworkWizard.jsx';
import {BluetoothReceiver} from './BluetoothReceiver.jsx';
const MusicWizard=lazy(()=>import('./MusicAssistantWizard.jsx').then(m=>({default:m.MusicAssistantWizard})));
const SoundWizard=lazy(()=>import('./SoundWizard.jsx').then(m=>({default:m.SoundWizard})));
const SyncWizard=lazy(()=>import('./SyncWizard.jsx').then(m=>({default:m.SyncWizard})));
export function SetupCards({snapshot,network,ids,onOpen}){
 const state=setupConnectionStatus(snapshot,network),ready={network:state.network,bluetooth:state.bluetoothConnected,music:state.music,sound:state.automaticSound,sync:state.sync};
 return <div className="setup-cards" aria-label={tr('Independent setup options')}>{setupJourneys.filter(j=>!ids||ids.includes(j.id)).map(j=><button key={j.id} onClick={()=>onOpen(j.id)}><Icon name={j.icon} size={38}/><strong>{tr(j.title)}</strong><span>{tr(ready[j.id]?'Connected / configured':'Optional · set up now or later')}</span></button>)}</div>;
}
export function SetupJourney({id,snapshot,offline=false,onClose,onComplete}){
 const props={snapshot,offline,onClose,onComplete:onComplete||onClose};
 if(id==='network')return <WizardShell title="Wi-Fi & network" steps={['Connection','Ready']} onClose={onClose} onNext={onComplete||onClose} nextLabel="Return to setup"><NetworkWizard offline={offline} onContinue={onComplete||onClose}/><p>{tr('Wi-Fi, Ethernet and Bluetooth can be used together. No music source is selected here.')}</p></WizardShell>;
 if(id==='bluetooth')return <WizardShell title="Bluetooth setup" steps={['Local output','Pair phone','Listen']} step={snapshot.bluetooth?.devices?.some(d=>d.connected)?2:snapshot.bluetooth?.active?1:0} onClose={onClose} onNext={onComplete||onClose} nextLabel="Return to setup"><BluetoothReceiver {...props}/><p>{tr('You can add Music Assistant separately. Both connections stay available; the local audio output plays one source at a time.')}</p></WizardShell>;
 return <Suspense fallback={<WizardShell title="Setup" busy steps={['Opening setup…']} onClose={onClose}><p>{tr('Opening setup…')}</p></WizardShell>}>{id==='music'?<MusicWizard {...props}/>:id==='sound'?<SoundWizard {...props}/>:id==='sync'?<SyncWizard {...props}/>:null}</Suspense>;
}
