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
const number=value=>Number.isFinite(value)&&value>-95?value.toFixed(1):'−∞';
/** Animate only the SVG/transform nodes, never FFT data or the whole React tree. */
function useMeterMotion(targets){
 const nodes=useRef([]),values=useRef([]),target=useRef([]),frame=useRef(null),last=useRef(0);
 useEffect(()=>{
  target.current=targets;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tick=time=>{
   const dt=Math.min(64,last.current?time-last.current:16);last.current=time;let unsettled=false;
   targets.forEach((_,i)=>{
    const next=target.current[i]||0,previous=values.current[i]||0;
    const v=reduced?next:previous+(next-previous)*(1-Math.exp(-dt/(next>previous?45:220)));
    values.current[i]=Math.abs(v-next)<.001?next:v;
    if(nodes.current[i])nodes.current[i].style.setProperty('--level',values.current[i]);
    if(Math.abs(v-next)>=.001)unsettled=true;
   });
   frame.current=unsettled?requestAnimationFrame(tick):null;
  };
  if(frame.current===null){last.current=0;frame.current=requestAnimationFrame(tick);}
  return()=>{cancelAnimationFrame(frame.current);frame.current=null;};
 },[JSON.stringify(targets)]);
 return nodes;
}
export function AudioPlot({audio,mode='spectrum',bands=32,offline=false,reference=-18,paused=false,diagnostics=false}){
 const real=!offline&&['pcm','silence'].includes(audio?.status)?audio.measurement:null;
 const resting=!offline&&(paused||audio?.configured&&audio?.enabled&&['idle','inactive','starting','busy','sleeping','hidden'].includes(audio.status));
 const measurement=paused&&audio?.matchesSelected!==false?null:real;
 const channels=measurement?.channels||[{rmsDb:-96,peakDb:-96,clippedSamples:0},{rmsDb:-96,peakDb:-96,clippedSamples:0}];
 const values=measurement?combineBands(measurement.bandsDb,bands):Array(bands).fill(-96);
 const levels=mode==='spectrum'?values.map(db=>db===null?0:Math.max(0,Math.min(1,(db+72)/72))):channels.map(c=>Math.max(0,Math.min(1,mode==='vu'?(c.rmsDb-reference+20)/23:(c.peakDb+60)/60)));
 const motion=useMeterMotion(levels);
 const visible=!!measurement||resting;
 return <section className="real-audio" data-style={mode} data-resting={resting&&!measurement} aria-label={tr('Real audio measurement')}>
 {visible?<>
  {mode==='spectrum'?<svg className="audio-spectrum" viewBox="0 0 640 280" role="img" aria-label={tr('Audio spectrum')+' · '+bands+' '+tr('bands')} preserveAspectRatio="none">{values.map((db,i)=><rect ref={node=>motion.current[i]=node} key={i} className={db===null?'audio-band unresolved':'audio-band'} x={i*640/values.length+2} y="0" width={640/values.length-5} height="244" style={{transformOrigin:`${i*640/values.length}px 244px`,transform:'scaleY(max(.006, var(--level, 0)))'}}/>)}<text x="0" y="276">20 Hz</text><text x="290" y="276">1 kHz</text><text x="560" y="276">20 kHz</text></svg>
  :<div className="audio-meter-pair">{channels.map((c,i)=><div key={i} style={{'--meter-color':i?'var(--meter-right,var(--accent))':'var(--meter-left,var(--accent))'}}>{mode==='bars'?<div className="audio-level-bar" role="meter" aria-label={tr(i?'Right PCM level':'Left PCM level')} aria-valuemin={-60} aria-valuemax={0} aria-valuenow={Math.max(-60,c.peakDb)}><span ref={node=>motion.current[i]=node}/><b>{i?'R':'L'}</b></div>:<svg viewBox="0 0 240 160" role="img" aria-label={tr((i?'Rechts':'Links')+' piekniveau '+number(c.peakDb)+' dBFS')}><path d="M24 124 Q120 4 216 124"/>{[0,1,2,3,4,5,6].map(t=><line key={t} className="meter-tick" x1="120" y1="26" x2="120" y2={t===6?'42':'35'} transform={`rotate(${-60+t*20} 120 132)`}/>)}<text x="16" y="110">{mode==='vu'?'−20':'−60'}</text><text x="200" y="110">{mode==='vu'?'+3':'0'}</text><line ref={node=>motion.current[i]=node} className="meter-needle" x1="120" y1="132" x2="120" y2="28" style={{transform:'rotate(calc(-60deg + var(--level, 0) * 120deg))'}}/><circle cx="120" cy="132" r="5" fill="currentColor"/><text x="120" y="158" textAnchor="middle">{i?'R':'L'}</text></svg>}</div>)}</div>}
  <div className="audio-readouts">{channels.map((channel,i)=><span key={i} aria-label={tr(i?'Right RMS':'Left RMS')}>{i?'R':'L'} {number(channel.rmsDb)} <small>dBFS</small>{channel.clippedSamples>0&&<b> FS</b>}</span>)}</div>
  {diagnostics&&<small>{measurement?`${(measurement.sampleRate/1000).toFixed(1)} kHz · ${tr('16-bit analysis copy')}`:tr('Paused')}</small>}
 </>:<div className="audio-unavailable"><strong>{tr(offline?'Audio unavailable':audio?.status==='disabled'?'Audio analysis is off':'Audio analysis is unavailable')}</strong>{diagnostics&&audio?.status!=='disabled'&&<span>{tr(labels[audio?.status]||'Waiting for audio…')}</span>}</div>}
 {mode==='vu'&&diagnostics&&<small>0 VU = {reference} dBFS</small>}
 </section>;
}
export function AudioVisualizer({mode='spectrum',bands=32,offline=false,awake=true,reference=-18,paused=false}){
 const {audio}=useAudioMeasurement(!offline&&awake);
 return <AudioPlot audio={audio} mode={mode} bands={bands} offline={offline} reference={reference} paused={paused}/>;
}
export function AudioSettings({prefs,update,offline=false}){
 const {audio,refresh}=useAudioMeasurement(!offline),device=useDeviceUpdates();const [pending,setPending]=useState(false),[notice,setNotice]=useState(''),[enabledDraft,setEnabledDraft]=useState(undefined);
 useEffect(()=>{if(!pending&&enabledDraft!==undefined&&audio?.enabled===enabledDraft)setEnabledDraft(undefined);},[audio?.enabled,pending,enabledDraft]);
 async function enable(enabled){setEnabledDraft(enabled);setPending(true);setNotice('');try{const response=await fetch('/api/audio/settings',{method:'POST',headers:{'Content-Type':'application/json','X-TuneBox-Control':device?.info?.controlToken||''},body:JSON.stringify({enabled}),signal:AbortSignal.timeout(5000)});const data=await response.json();if(!response.ok)throw Error(data.error);setNotice(enabled?'Echte meting ingeschakeld · geen wijziging aan audio-uitgang':'PCM-reader en analyse uitgeschakeld');refresh();}catch(error){setEnabledDraft(undefined);setNotice(error.message);}finally{setPending(false);}}
 return <div className="audio-settings"><div className="audio-settings-controls"><label className="update-toggle"><input aria-label={tr("Echte audiometing inschakelen")} type="checkbox" checked={enabledDraft??audio?.enabled===true} disabled={offline||audio?.status==='offline'||pending||!device?.info?.controlToken||!audio?.configured&&!audio?.enabled} onChange={e=>enable(e.target.checked)}/>{tr("Echte audiometing")}</label><label>{tr("Visualizer")}<select aria-label={tr("Visualizer weergave")} value={prefs.visualizer} onChange={e=>update('visualizer',e.target.value)}><option value="off">{tr("Uit")}</option><option value="meters">{tr("Stereo dBFS-meters")}</option><option value="spectrum">{tr("Spectrum")}</option></select></label><label>{tr("Spectrumbanden")}<select aria-label={tr("Spectrumbanden")} value={prefs.visualizerBands} onChange={e=>update('visualizerBands',Number(e.target.value))}><option value="16">16</option><option value="32">32</option></select></label><p>{tr("Meten stopt automatisch zonder zichtbare weergave of bij schermslaap. De hoofdschakelaar stopt alle meetlezers.")}</p><small>{tr("PCM-export, geen watt/SPL; volume en mute zijn niet gekalibreerd. ")}<a href="/docs/audio-analysis.md" target="_blank" rel="noreferrer">{tr("Installatie en beperkingen")}</a></small><p role="status">{tr(notice||(!audio?.configured?'The PCM reader is not installed. Run the command below on the Pi, then reload this page.':'Bron: lokale Squeezelite · '+(audio?.playerId||'')))}</p>{!audio?.configured&&<code className="setup-command">{tr("sudo bash /opt/daw-one/deploy/install-audio-analysis.sh --detect --enable-export")}</code>}</div><AudioPlot diagnostics audio={enabledDraft===false?{...audio,status:"disabled",measurement:null}:audio} mode={prefs.visualizer==='off'?'spectrum':prefs.visualizer} bands={prefs.visualizerBands} offline={offline}/></div>;
}
