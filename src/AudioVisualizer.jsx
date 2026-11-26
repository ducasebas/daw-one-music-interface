import {visualFraction,visualResponse} from '../shared/visualizer-motion.js';
import {tr} from "../shared/i18n.js";
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {useDeviceUpdates} from './DeviceUpdates.jsx';
import {meterFraction,meterMarks,meterScale,polar} from '../shared/meter-scale.js';
import {MeasurementDelay,visualizerDelay,playbackDiscontinuity} from '../shared/presentation-timing.js';
import {connectAudio} from './audio-connection.js';
import {createAudioSource} from './audio-source.js';
const labels={'not-configured':'PCM-reader nog niet geïnstalleerd',disabled:'Echte audiometing uitgeschakeld',inactive:'Meting niet actief',sleeping:'Meting gepauzeerd · scherm slaapt',starting:'PCM-reader starten…','source-missing':'No Squeezelite PCM export · restart the player or TuneBox; a closed login session may have removed it',idle:'PCM-export inactief · geen meetwaarden',stale:'PCM-export verouderd · meetwaarden onbekend',busy:'PCM-buffer verandert · nieuwe meting afwachten',incompatible:'PCM-export heeft een niet-ondersteunde ABI','reader-error':'PCM-reader niet beschikbaar',offline:'Backend offline · meetwaarden onbekend',hidden:'Meting gepauzeerd'};
export function useAudioMeasurement(active=true,{paused=false,spectrum=true}={}){
 const [audio,setAudio]=useState(null),connection=useRef(null),source=useRef(null);if(!source.current)source.current=createAudioSource();
 useEffect(()=>{const next=connectAudio({active,paused,spectrum,onAudio:value=>{if(source.current.publish(value))setAudio(source.current.metadata);}});connection.current=next;return()=>{next.stop();if(connection.current===next)connection.current=null;};},[active,paused]);
 useEffect(()=>{connection.current?.setSpectrum?.(spectrum);},[spectrum]);
 return {audio,frames:source.current,refresh:useCallback(()=>connection.current?.refresh(),[])};
}
export function combineBands(bands,count){
 if(count!==16)return bands;
 return Array.from({length:16},(_,i)=>{const values=bands.slice(i*2,i*2+2).filter(x=>typeof x==='number'&&Number.isFinite(x));return values.length?Math.min(0,10*Math.log10(values.reduce((sum,db)=>sum+Math.pow(10,db/10),0))):null;});
}
const number=value=>Number.isFinite(value)&&value>-95?value.toFixed(1):'−∞';
export const meterFrameMs=33;
/** Animate only the SVG/transform nodes, never FFT data or the whole React tree. */
function useMeterMotion(targets,response='natural',lowPower=false){
 const speed=useRef(visualResponse(response));speed.current=visualResponse(response);const cadence=lowPower?meterFrameMs:16;
 const nodes=useRef([]),painted=useRef([]),values=useRef([]),target=useRef([]),frame=useRef(null),last=useRef(0),drive=useRef(null);
 const setTargets=useCallback(next=>{target.current=next;if(frame.current===null&&drive.current&&next.some((value,i)=>Math.abs(value-(values.current[i]||0))>=.001||nodes.current[i]&&painted.current[i]!==nodes.current[i])){last.current=0;frame.current=requestAnimationFrame(drive.current);}},[]);
 useEffect(()=>{
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const tick=time=>{
   // At most ~30 fps. New targets update this running animation instead of restarting its clock.
   if(last.current&&time-last.current<cadence){frame.current=requestAnimationFrame(tick);return;}
   const dt=Math.min(64,last.current?time-last.current:16);last.current=time;let unsettled=false;
   target.current.forEach((_,i)=>{
    const next=target.current[i]||0,previous=values.current[i]||0;
    const v=reduced.matches?next:previous+(next-previous)*(1-Math.exp(-dt/(next>previous?speed.current.attack:speed.current.release)));
    const level=Math.abs(v-next)<.001?next:v,node=nodes.current[i];
    if(node&&(painted.current[i]!==node||values.current[i]!==level)){node.style.setProperty('--level',level);painted.current[i]=node;}
    values.current[i]=level;
    if(Math.abs(v-next)>=.001)unsettled=true;
   });
   frame.current=unsettled?requestAnimationFrame(tick):null;
  };
  drive.current=tick;setTargets(target.current);
  return()=>{drive.current=null;cancelAnimationFrame(frame.current);frame.current=null;};
 },[setTargets,cadence]);
 useEffect(()=>setTargets(targets),[JSON.stringify(targets),setTargets]);
 return {nodes,setTargets};
}
/** Delay real analysis frames by their arrival clock. No synthetic or future audio. */
function useDelayedMeasurement(audio,{frames,onMeasurement,timing,offline,paused,timeline}){
 const queue=useRef(new MeasurementDelay()),previous=useRef(null),blocked=useRef(null),[shown,setShown]=useState(null);
 const delay=visualizerDelay(timing),track=timeline?.queue?.[timeline?.index];
 const key=JSON.stringify([timeline?.playerId,track?.mediaKey||track?.id,track?.title,track?.artist]);
 const point={key,playing:timeline?.playing,position:timeline?.position,observedAt:timeline?.observedAt};
 useEffect(()=>{
  let timer;
  const changed=playbackDiscontinuity(previous.current,point);previous.current=point;
  const show=value=>frames?onMeasurement(value?.measurement||null):setShown(value);
  const initial=frames?.get()||audio,initialStamp=initial?.measurement?.capturedAt??initial?.measurement?.sourceUpdatedAt;
  if(changed){queue.current.clear();blocked.current=initialStamp;show(null);}
  const present=()=>{const now=performance.now();show(queue.current.read(now,delay));const due=queue.current.nextDue(now,delay);if(due!==null)timer=setTimeout(present,Math.max(1,due-now));};
  const receive=value=>{
   clearTimeout(timer);
   if(offline||paused||audio?.enabled===false||audio?.status==='disabled'||!['pcm','silence'].includes(value?.status)||!value?.measurement||value.enabled===false){queue.current.clear();show(null);return;}
   const stamp=value.measurement.capturedAt??value.measurement.sourceUpdatedAt;
   if(stamp!==undefined&&stamp===blocked.current)return;
   blocked.current=null;queue.current.push(value,performance.now(),key);present();
  };
  const unsubscribe=frames?.subscribe(receive);receive(initial);
  return()=>{unsubscribe?.();clearTimeout(timer);};
 },[audio,frames,onMeasurement,key,timeline?.position,timeline?.observedAt,timeline?.playing,delay,offline,paused]);
 if(frames)return null;
 const valid=!offline&&!paused&&['pcm','silence'].includes(audio?.status)&&audio?.enabled!==false;
 return valid?shown?.measurement:null;
}
/** One analogue dial: a scale arc, dB marks and labels, a red zone and the needle. */
function MeterDial({mode,label,needle,side,root,sensitivity=0}){
 const scale=meterScale(mode),marks=meterMarks(mode).map(m=>({...m,angle:-60+120*visualFraction((m.angle+60)/120,sensitivity)})),hot=marks.find(m=>m.value>=scale.hot)?.angle??60;
 const arc=(r,from,to)=>{const [x1,y1]=polar(120,132,r,from),[x2,y2]=polar(120,132,r,to);return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;};
 return <svg ref={root} viewBox="0 0 240 160" role="img" aria-label={label} data-scale={scale.unit}>
  <path className="meter-arc" d={arc(100,-60,hot)}/><path className="meter-arc meter-hot" d={arc(100,hot,60)}/>
  {marks.map(m=>{const [x1,y1]=polar(120,132,m.label?90:94,m.angle),[x2,y2]=polar(120,132,102,m.angle),[lx,ly]=polar(120,132,114,m.angle);return <g key={m.value} className={m.hot?'meter-mark meter-hot':'meter-mark'} data-db={m.value}><line className="meter-tick" data-major={!!m.label} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)}/>{m.label&&<text className="meter-label" x={lx.toFixed(1)} y={(ly+4).toFixed(1)} textAnchor="middle">{m.label}</text>}</g>;})}
  <text className="meter-unit" x="120" y="92" textAnchor="middle">{scale.unit}</text>
  <line ref={needle} className="meter-needle" x1="120" y1="132" x2="120" y2="28" style={{transform:'rotate(calc(-60deg + var(--level, 0) * 120deg))'}}/><circle cx="120" cy="132" r="6" fill="currentColor"/><text className="meter-side" x="120" y="158" textAnchor="middle">{side}</text>
 </svg>;
}
export function AudioPlot({audio,frames,mode='spectrum',bands=32,offline=false,reference=-18,paused=false,diagnostics=false,timing,timeline,sensitivity=0,response='natural',lowPower=false}){
 const root=useRef(null),meters=useRef([]),diagnostic=useRef(null),motion=useMeterMotion([],response,lowPower);
 const paint=useCallback(measurement=>{
  root.current?.setAttribute('data-captured-at',measurement?.capturedAt??'');root.current?.setAttribute('data-resting',String(!measurement));
  const channels=measurement?.channels||[{rmsDb:-96,peakDb:-96},{rmsDb:-96,peakDb:-96}],values=measurement?combineBands(measurement.bandsDb,bands):Array(bands).fill(-96);
  motion.setTargets(mode==='spectrum'?values.map(db=>db===null?0:visualFraction((db+72)/72,sensitivity)):channels.map(c=>mode==='vu'?visualFraction(meterFraction(c.rmsDb-reference,'vu'),sensitivity):mode==='bars'?visualFraction((c.peakDb+60)/60,sensitivity):visualFraction(meterFraction(c.peakDb,'meters'),sensitivity)));
  if(mode==='spectrum')values.forEach((db,i)=>motion.nodes.current[i]?.classList.toggle('unresolved',db===null));
  else channels.forEach((c,i)=>{if(mode==='bars')meters.current[i]?.setAttribute('aria-valuenow',Math.max(-60,c.peakDb));else meters.current[i]?.setAttribute('aria-label',tr((i?'Rechts':'Links')+' piekniveau '+number(c.peakDb)+' dBFS'));});
  if(diagnostic.current){const text=measurement?`${(measurement.sampleRate/1000).toFixed(1)} kHz · ${tr('16-bit analysis copy')}`:tr(!paused&&['pcm','silence'].includes(audio?.status)?'Aligning meters…':'Paused');if(diagnostic.current.textContent!==text)diagnostic.current.textContent=text;}
 },[mode,bands,reference,sensitivity,motion.setTargets,paused,audio?.status]);
 const delayed=useDelayedMeasurement(audio,{frames,onMeasurement:paint,timing,offline,paused:paused&&audio?.matchesSelected!==false,timeline});
 const real=delayed;
 const resting=!offline&&(paused||audio?.configured&&audio?.enabled&&['pcm','silence','idle','inactive','starting','busy','sleeping','hidden'].includes(audio.status));
 const measurement=paused&&audio?.matchesSelected!==false?null:real;
 const channels=measurement?.channels||[{rmsDb:-96,peakDb:-96,clippedSamples:0},{rmsDb:-96,peakDb:-96,clippedSamples:0}];
 const values=measurement?combineBands(measurement.bandsDb,bands):Array(bands).fill(-96);
 const levels=mode==='spectrum'?values.map(db=>db===null?0:visualFraction((db+72)/72,sensitivity)):channels.map(c=>mode==='vu'?visualFraction(meterFraction(c.rmsDb-reference,'vu'),sensitivity):mode==='bars'?visualFraction((c.peakDb+60)/60,sensitivity):visualFraction(meterFraction(c.peakDb,'meters'),sensitivity));
 useEffect(()=>{if(!frames)motion.setTargets(levels);},[frames,JSON.stringify(levels),motion.setTargets]);
 const visible=!!measurement||resting;
 // The owner switched analysis off on purpose: no reminder in their face, just no meters.
 if(!visible&&!offline&&audio?.status==='disabled')return null;
 return <section ref={root} className="real-audio" data-style={mode} data-delay-ms={visualizerDelay(timing)} data-captured-at={frames?undefined:measurement?.capturedAt??''} data-resting={frames?undefined:resting&&!measurement} aria-label={tr('Real audio measurement')}>
 {visible?<>
  {mode==='spectrum'?<><svg className="audio-spectrum" viewBox="0 0 640 244" role="img" aria-label={tr('Audio spectrum')+' · '+bands+' '+tr('bands')} preserveAspectRatio="none">{values.map((db,i)=><rect ref={node=>motion.nodes.current[i]=node} key={i} className={db===null?'audio-band unresolved':'audio-band'} x={i*640/values.length+2} y="0" width={640/values.length-5} height="244" style={{transformOrigin:`${i*640/values.length}px 244px`,transform:'scaleY(max(.006, var(--level, 0)))'}}/>)}</svg><div className="audio-frequencies" aria-hidden="true"><span>20 Hz</span><span>1 kHz</span><span>20 kHz</span></div></>
  :<div className="audio-meter-pair">{channels.map((c,i)=><div key={i} style={{'--meter-color':i?'var(--meter-right,var(--accent))':'var(--meter-left,var(--accent))'}}>{mode==='bars'?<div ref={node=>meters.current[i]=node} className="audio-level-bar" role="meter" aria-label={tr(i?'Right PCM level':'Left PCM level')} aria-valuemin={-60} aria-valuemax={0} aria-valuenow={frames?undefined:Math.max(-60,c.peakDb)}><span ref={node=>motion.nodes.current[i]=node}/><b>{i?'R':'L'}</b></div>:<MeterDial sensitivity={sensitivity} mode={mode} label={frames?undefined:tr((i?'Rechts':'Links')+' piekniveau '+number(c.peakDb)+' dBFS')} root={node=>meters.current[i]=node} needle={node=>motion.nodes.current[i]=node} side={i?'R':'L'}/>}</div>)}</div>}
  {diagnostics&&<small ref={diagnostic}>{frames?null:measurement?`${(measurement.sampleRate/1000).toFixed(1)} kHz · ${tr('16-bit analysis copy')}`:tr(!paused&&['pcm','silence'].includes(audio?.status)?'Aligning meters…':'Paused')}</small>}
 </>:<div className="audio-unavailable"><strong>{tr(offline?'Audio unavailable':audio?.status==='disabled'?'Audio analysis is off':'Audio analysis is unavailable')}</strong>{diagnostics&&audio?.status!=='disabled'&&<span>{tr(labels[audio?.status]||'Waiting for audio…')}</span>}</div>}
 {mode==='vu'&&diagnostics&&<small>0 VU = {reference} dBFS</small>}
 </section>;
}
export function AudioVisualizer({mode='spectrum',bands=32,offline=false,awake=true,reference=-18,paused=false,timing,timeline,sensitivity=0,response='natural',lowPower=false}){
 const {audio,frames}=useAudioMeasurement(!offline&&awake,{paused,spectrum:mode==='spectrum'});
 return <AudioPlot sensitivity={sensitivity} response={response} lowPower={lowPower} audio={audio} frames={frames} mode={mode} bands={bands} offline={offline||!awake} reference={reference} paused={paused} timing={timing} timeline={timeline}/>;
}
export function AudioSettings({prefs,update,offline=false}){
 const {audio,frames,refresh}=useAudioMeasurement(!offline,{spectrum:prefs.visualizer!=='meters'}),device=useDeviceUpdates();const [pending,setPending]=useState(false),[notice,setNotice]=useState(''),[enabledDraft,setEnabledDraft]=useState(undefined);
 useEffect(()=>{if(!pending&&enabledDraft!==undefined&&audio?.enabled===enabledDraft)setEnabledDraft(undefined);},[audio?.enabled,pending,enabledDraft]);
 async function enable(enabled){setEnabledDraft(enabled);setPending(true);setNotice('');try{const response=await fetch('/api/audio/settings',{method:'POST',headers:{'Content-Type':'application/json','X-TuneBox-Control':device?.info?.controlToken||''},body:JSON.stringify({enabled}),signal:AbortSignal.timeout(5000)});const data=await response.json();if(!response.ok)throw Error(data.error);setNotice(enabled?'Echte meting ingeschakeld · geen wijziging aan audio-uitgang':'PCM-reader en analyse uitgeschakeld');refresh();}catch(error){setEnabledDraft(undefined);setNotice(error.message);}finally{setPending(false);}}
 return <div className="audio-settings"><div className="audio-settings-controls"><label className="update-toggle"><input aria-label={tr("Echte audiometing inschakelen")} type="checkbox" checked={enabledDraft??audio?.enabled===true} disabled={offline||audio?.status==='offline'||pending||!device?.info?.controlToken||!audio?.configured&&!audio?.enabled} onChange={e=>enable(e.target.checked)}/>{tr("Echte audiometing")}</label><label>{tr("Visualizer")}<select aria-label={tr("Visualizer weergave")} value={prefs.visualizer} onChange={e=>update('visualizer',e.target.value)}><option value="off">{tr("Uit")}</option><option value="meters">{tr("Stereo dBFS-meters")}</option><option value="spectrum">{tr("Spectrum")}</option></select></label><label>{tr("Spectrumbanden")}<select aria-label={tr("Spectrumbanden")} value={prefs.visualizerBands} onChange={e=>update('visualizerBands',Number(e.target.value))}><option value="16">16</option><option value="32">32</option></select></label><p>{tr("Meten stopt automatisch zonder zichtbare weergave of bij schermslaap. De hoofdschakelaar stopt alle meetlezers.")}</p><small>{tr("PCM-export, geen watt/SPL; volume en mute zijn niet gekalibreerd. ")}<a href="/docs/audio-analysis.md" target="_blank" rel="noreferrer">{tr("Installatie en beperkingen")}</a></small><p role="status">{tr(notice||(!audio?.configured?'The PCM reader is not installed. Run the command below on the Pi, then reload this page.':'Bron: lokale Squeezelite · '+(audio?.playerId||'')))}</p>{!audio?.configured&&<code className="setup-command">{tr("sudo bash /opt/daw-one/deploy/install-audio-analysis.sh --detect --enable-export")}</code>}</div><AudioPlot frames={frames} timing={prefs.timing} diagnostics audio={enabledDraft===false?{...audio,status:"disabled",measurement:null}:audio} mode={prefs.visualizer==='off'?'spectrum':prefs.visualizer} bands={prefs.visualizerBands} offline={offline}/></div>;
}
