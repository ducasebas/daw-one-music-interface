import {tr} from "../shared/i18n.js";
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {useDeviceUpdates} from './DeviceUpdates.jsx';
const labels={'not-configured':'PCM-reader nog niet geïnstalleerd',disabled:'Echte audiometing uitgeschakeld',inactive:'Meting niet actief',sleeping:'Meting gepauzeerd · scherm slaapt',starting:'PCM-reader starten…','source-missing':'Geen Squeezelite PCM-export · controleer -v',idle:'PCM-export inactief · geen meetwaarden',stale:'PCM-export verouderd · meetwaarden onbekend',busy:'PCM-buffer verandert · nieuwe meting afwachten',incompatible:'PCM-export heeft een niet-ondersteunde ABI','reader-error':'PCM-reader niet beschikbaar',offline:'Backend offline · meetwaarden onbekend',hidden:'Meting gepauzeerd'};
export function useAudioMeasurement(active=true){
 const [audio,setAudio]=useState(null),refresh=useRef(()=>{});
 useEffect(()=>{let mounted=true,timer,controller,generation=0;
  const poll=async()=>{
   const own=++generation;
   if(!active||document.hidden){setAudio(old=>({...old,status:'hidden',measurement:null}));return;}
   controller=new AbortController();const abort=setTimeout(()=>controller.abort(),2000);
   try{const response=await fetch('/api/audio?watch=1',{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error();const value=await response.json();if(mounted&&own===generation)setAudio(value);
    if(mounted&&own===generation)timer=setTimeout(poll,value.enabled&&value.configured?100:2000);
   }catch{if(mounted&&own===generation){setAudio(old=>({...old,status:'offline',measurement:null}));timer=setTimeout(poll,2000);}}
   finally{clearTimeout(abort);}
  };
  const wake=()=>{generation++;clearTimeout(timer);controller?.abort();if(mounted)poll();};refresh.current=wake;document.addEventListener('visibilitychange',wake);poll();
  return()=>{mounted=false;generation++;clearTimeout(timer);controller?.abort();document.removeEventListener('visibilitychange',wake);};
 },[active]);
 return {audio,refresh:useCallback(()=>refresh.current(),[])};
}
export function combineBands(bands,count){
 if(count!==16)return bands;
 return Array.from({length:16},(_,i)=>{const values=bands.slice(i*2,i*2+2).filter(x=>typeof x==='number'&&Number.isFinite(x));return values.length?Math.min(0,10*Math.log10(values.reduce((sum,db)=>sum+Math.pow(10,db/10),0))):null;});
}
const number=value=>Number.isFinite(value)?value.toFixed(1):'—';
export function AudioPlot({audio,mode='spectrum',bands=32,offline=false,reference=-18}){
 const measurement=!offline&&['pcm','silence'].includes(audio?.status)?audio.measurement:null;
 const values=measurement?combineBands(measurement.bandsDb,bands):[];
 return <section className="real-audio" data-style={mode} aria-label={tr("Echte PCM-audiometing")}><small>{tr("LOKALE PCM · dBFS")}</small>{measurement?<>
  {mode==='spectrum'?<svg className="audio-spectrum" viewBox="0 0 320 100" role="img" aria-label={tr('Echt audiospectrum · '+bands+' banden')}>{values.map((db,i)=><rect key={i} className={db===null?'audio-band unresolved':'audio-band'} x={i*320/values.length+1} y="0" width={320/values.length-3} height="88" style={{transform:`scaleY(${db===null?.01:Math.max(.01,Math.min(1,(db+72)/72))})`}}/>)}<text x="0" y="99">{tr("20 Hz")}</text><text x="145" y="99">{tr("1 kHz")}</text><text x="280" y="99">{tr("20 kHz")}</text></svg>
  :<div className="audio-meter-pair">{measurement.channels.map((c,i)=><div key={i} style={{color:i?'var(--meter-right,var(--accent))':'var(--meter-left,var(--accent))'}}><meter className="stereo-level" aria-label={tr(i?'Right PCM level':'Left PCM level')} min={-60} max={0} value={Math.max(-60,c.peakDb)}/><svg viewBox="0 0 120 75" role="img" aria-label={tr((i?'Rechts':'Links')+' piekniveau '+number(c.peakDb)+' dBFS')}><path d="M12 60 Q60 0 108 60"/><text x="8" y="43">{mode==='vu'?'−20':'−60'}</text><text x="98" y="43">{mode==='vu'?'+3':'0'}</text><line x1="60" y1="62" x2="60" y2="15" style={{transform:`rotate(${-60+Math.max(0,Math.min(1,mode==='vu'?(c.rmsDb-reference+20)/23:(c.peakDb+60)/60))*120}deg)`}}/><text x="60" y="73" textAnchor="middle">{tr(i?'R':'L')}</text></svg></div>)}</div>}
  <div className="audio-readouts">{measurement.channels.map((channel,i)=><span key={i} aria-label={tr((i?'Rechts':'Links')+' RMS')}>{tr(i?'R':'L')} {tr(number(channel.rmsDb))} <small>{tr("dBFS")}</small>{channel.clippedSamples>0&&<b title={tr("Samples op digitale volle schaal; geen versterkerfoutmeting")}>{tr(" FS")}</b>}</span>)}</div>
  <small>{tr(measurement.silent?'Echte PCM-stilte':(measurement.sampleRate/1000).toFixed(1)+' kHz · '+tr('16-bit analysis copy'))}</small>
 </>:<div className="audio-unavailable"><strong>{tr(offline?labels.offline:labels[audio?.status]||'Metingen ophalen…')}</strong><span>{tr("Geen gesimuleerde of uit metadata afgeleide niveaus.")}</span></div>}
 {mode==='vu'&&<small>{tr('VU-style display')} · 0 VU = {reference} dBFS</small>}
 {measurement&&!audio?.matchesSelected&&<span className="audio-source-note">{tr("Lokale meting · geselecteerde speler niet bevestigd")}</span>}
 </section>;
}
export function AudioVisualizer({mode='spectrum',bands=32,offline=false,awake=true,reference=-18}){
 const {audio}=useAudioMeasurement(!offline&&awake);
 return <AudioPlot audio={audio} mode={mode} bands={bands} offline={offline} reference={reference}/>;
}
export function AudioSettings({prefs,update,offline=false}){
 const {audio,refresh}=useAudioMeasurement(!offline),device=useDeviceUpdates();const [pending,setPending]=useState(false),[notice,setNotice]=useState(''),[enabledDraft,setEnabledDraft]=useState(undefined);
 useEffect(()=>{if(!pending&&enabledDraft!==undefined&&audio?.enabled===enabledDraft)setEnabledDraft(undefined);},[audio?.enabled,pending,enabledDraft]);
 async function enable(enabled){setEnabledDraft(enabled);setPending(true);setNotice('');try{const response=await fetch('/api/audio/settings',{method:'POST',headers:{'Content-Type':'application/json','X-TuneBox-Control':device?.info?.controlToken||''},body:JSON.stringify({enabled}),signal:AbortSignal.timeout(5000)});const data=await response.json();if(!response.ok)throw Error(data.error);setNotice(enabled?'Echte meting ingeschakeld · geen wijziging aan audio-uitgang':'PCM-reader en analyse uitgeschakeld');refresh();}catch(error){setEnabledDraft(undefined);setNotice(error.message);}finally{setPending(false);}}
 return <div className="audio-settings"><div className="audio-settings-controls"><label className="update-toggle"><input aria-label={tr("Echte audiometing inschakelen")} type="checkbox" checked={enabledDraft??audio?.enabled===true} disabled={offline||audio?.status==='offline'||pending||!device?.info?.controlToken||!audio?.configured&&!audio?.enabled} onChange={e=>enable(e.target.checked)}/>{tr("Echte audiometing")}</label><label>{tr("Visualizer")}<select aria-label={tr("Visualizer weergave")} value={prefs.visualizer} onChange={e=>update('visualizer',e.target.value)}><option value="off">{tr("Uit")}</option><option value="meters">{tr("Stereo dBFS-meters")}</option><option value="spectrum">{tr("Spectrum")}</option></select></label><label>{tr("Spectrumbanden")}<select aria-label={tr("Spectrumbanden")} value={prefs.visualizerBands} onChange={e=>update('visualizerBands',Number(e.target.value))}><option value="16">16</option><option value="32">32</option></select></label><p>{tr("Meten stopt automatisch zonder zichtbare weergave of bij schermslaap. De hoofdschakelaar stopt alle meetlezers.")}</p><small>{tr("PCM-export, geen watt/SPL; volume en mute zijn niet gekalibreerd. ")}<a href="/docs/audio-analysis.md" target="_blank" rel="noreferrer">{tr("Installatie en beperkingen")}</a></small><p role="status">{tr(notice||(!audio?.configured?'The PCM reader is not installed. Run the command below on the Pi, then reload this page.':'Bron: lokale Squeezelite · '+(audio?.playerId||'')))}</p>{!audio?.configured&&<code className="setup-command">{tr("sudo bash /opt/daw-one/deploy/install-audio-analysis.sh --detect --enable-export")}</code>}</div><AudioPlot audio={enabledDraft===false?{...audio,status:"disabled",measurement:null}:audio} mode={prefs.visualizer==='off'?'spectrum':prefs.visualizer} bands={prefs.visualizerBands} offline={offline}/></div>;
}
