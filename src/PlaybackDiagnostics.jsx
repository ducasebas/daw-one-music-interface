import React,{useEffect,useState} from 'react';
import {tr} from '../shared/i18n.js';
export function PlaybackDiagnostics({offline}){
 const [value,setValue]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function read(){setBusy(true);setError('');try{const r=await fetch('/api/playback/diagnostics',{cache:'no-store',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Audio diagnostics are unavailable.');setValue(await r.json());}catch(e){setError(e.message);}finally{setBusy(false);}}
 useEffect(()=>{if(!offline)read();},[offline]);const o=value?.output;
 return <section className="playback-diagnostics"><h3>{tr('Audio diagnostics')}</h3><p>{tr('Read-only output information. PCM bitrate is the local uncompressed audio data rate, not network traffic or amplifier power.')}</p>{o&&<dl className="system-facts"><dt>{tr('Output state')}</dt><dd>{o.state||tr('Unknown')}</dd><dt>{tr('Audio format')}</dt><dd>{o.format||tr('Not available')}</dd><dt>{tr('Sample rate')}</dt><dd>{o.rate?`${o.rate/1000} kHz`:tr('Not available')}</dd><dt>{tr('Channels')}</dt><dd>{o.channels||'—'}</dd><dt>{tr('PCM data rate')}</dt><dd>{o.pcmBitrate?`${(o.pcmBitrate/1e6).toFixed(2)} Mbit/s`:tr('Not available')}</dd></dl>}<p>{tr('These values do not prove that all playback interruptions are detected. Silence is never treated as a failure.')}</p><button disabled={offline||busy} onClick={read} aria-busy={busy}>{tr(busy?'Reading output…':'Read output again')}</button>{error&&<p role="alert">{tr(error)}</p>}</section>;
}
