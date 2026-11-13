import {tr,translateFormat} from '../shared/i18n.js';
import {Icon} from './Icon.jsx';
import React,{useEffect,useRef,useState} from 'react';
import {useDeviceUpdates} from './DeviceUpdates.jsx';
import {localVideoSync,videoAdjustment} from '../shared/video.js';
import {positionAt} from '../shared/playback.js';
import {presentationTiming,playbackDiscontinuity} from '../shared/presentation-timing.js';

const identity=track=>JSON.stringify([track?.mediaKey||track?.id,track?.title,track?.artist,track?.album]);
const profile=(link,prefs)=>link?.sync||{mode:'ends',offsetSeconds:prefs.correction||0};
function useVideoLink(track){
 const key=identity(track),[state,setState]=useState(null),[revision,setRevision]=useState(0);
 useEffect(()=>{let live=true;const controller=new AbortController();setState(null);const timeout=setTimeout(()=>controller.abort(),10000);fetch('/api/video',{signal:controller.signal,cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(link=>{if(live)setState({key,link});}).catch(()=>{if(live)setState({key,link:{available:false,loadError:true}});}).finally(()=>clearTimeout(timeout));return()=>{live=false;clearTimeout(timeout);controller.abort();};},[key,revision]);
 return [state?.key===key?state.link:null,()=>setRevision(v=>v+1)];
}

/** One video element for inline and full-screen presentation. Audio stays with MA. */
function VideoSurface({snapshot,prefs,link,offline=false,onConfigure,preview=false}){
 const track=snapshot.playback?.queue?.[snapshot.playback.index],ref=useRef(null),dialog=useRef(null),fullButton=useRef(null),latest=useRef(null);
 const [duration,setDuration]=useState(null),[failed,setFailed]=useState(false),[expanded,setExpanded]=useState(false),[state,setState]=useState('loading');
 latest.current={snapshot,prefs,link,offline};
 useEffect(()=>{setFailed(false);setDuration(null);setState('loading');},[link?.url]);
 useEffect(()=>{
  const video=ref.current;if(!video||!Number.isFinite(duration)||failed)return;
  let lastSeek=-Infinity,previous=null,forced=true,playingRequest=false,alive=true;
  const tick=()=>{
   const v=latest.current,p=v.snapshot.playback,currentTrack=p?.queue?.[p.index];
   if(!p||v.offline||document.hidden||v.snapshot.device.displayAwake===false){video.pause();video.playbackRate=1;setState(v.offline?'offline':'paused');forced=true;return;}
   const point={key:identity(currentTrack)+'|'+p.playerId,position:p.position,observedAt:p.observedAt,playing:p.playing};
   if(playbackDiscontinuity(previous,point))forced=true;previous=point;
   const sync=localVideoSync({audioPosition:positionAt(p,Date.now()),audioDuration:currentTrack?.duration,videoDuration:duration,...profile(v.link,v.prefs),screenDelayMs:presentationTiming(v.prefs.timing).screenDelayMs,playing:p.playing});
   if(sync.status==='fallback'){video.pause();setState('unavailable');return;}
   if(!sync.playing)video.pause();
   const action=videoAdjustment({target:sync.position,current:video.currentTime,playing:sync.playing,ready:video.readyState>=1,seeking:video.seeking,now:performance.now(),lastSeek,force:forced});
   video.dataset.driftMs=Number.isFinite(action.error)?String(Math.round(action.error*1000)):'';
   video.dataset.syncStatus=sync.status;
   if(action.kind==='seek'){
    try{video.currentTime=sync.position;lastSeek=performance.now();forced=false;}catch{}
   }else if(action.kind==='rate'){video.playbackRate=action.rate;forced=false;}
   if(sync.playing&&video.paused&&!playingRequest){playingRequest=true;video.play().catch(error=>{if(alive&&error.name!=='AbortError')setFailed(true);}).finally(()=>playingRequest=false);}
   setState(sync.status==='waiting'?'waiting':sync.status==='ended'?'ended':sync.playing?(video.readyState<3?'buffering':'playing'):'paused');
  };
  const seeked=()=>tick();video.addEventListener('seeked',seeked);document.addEventListener('visibilitychange',tick);tick();const timer=setInterval(tick,125);
  return()=>{alive=false;clearInterval(timer);video.removeEventListener('seeked',seeked);document.removeEventListener('visibilitychange',tick);video.pause();video.playbackRate=1;};
 },[duration,link?.url,failed]);
 function enterFull(){const node=dialog.current;if(!node)return;node.close();node.showModal();setExpanded(true);}
 function exitFull(){const node=dialog.current;if(node){node.close();node.show();}setExpanded(false);requestAnimationFrame(()=>fullButton.current?.focus());}
 useEffect(()=>()=>{dialog.current?.close();},[]);
 const message={loading:'Loading video…',buffering:'Loading video…',waiting:'Waiting for the video start…',ended:'Video ended · music continues',paused:'Paused',offline:'Video paused · reconnecting',unavailable:'Video timing is unavailable',playing:'Video follows your music'}[state];
 return <dialog ref={dialog} open role={expanded?'dialog':'region'} aria-modal={expanded||undefined} aria-label={tr(expanded?'Full screen video':preview?'Video timing preview':'Video artwork')} className={'video-surface '+(expanded?'video-expanded':'')} onCancel={e=>{e.preventDefault();exitFull();}}>
  {expanded&&<header><div><strong>{track?.title}</strong><span>{track?.artist}</span></div><button onClick={exitFull}><Icon name="close"/>{tr('Back to music')}</button></header>}
  {!link?<section className="video-unavailable" role="status">{tr('Loading video…')}</section>:!link.available||failed?<section className="video-unavailable"><strong>{tr(failed?'Video could not play':link.loadError?'Video is unavailable':'No video linked to this track')}</strong><p>{tr(failed?'Try an MP4 with H.264 video at 720p and 30 fps. Your music keeps playing.':link.loadError?'Reconnect and reopen Video Artwork. Your music is unchanged.':'Link your own MP4 or WebM in Video settings.')}</p>{onConfigure&&<button onClick={onConfigure}>{tr('Video settings')}</button>}</section>:<video ref={ref} key={link.url} src={link.url} muted playsInline preload="auto" disablePictureInPicture disableRemotePlayback controlsList="nodownload noremoteplayback nofullscreen" onLoadedMetadata={e=>setDuration(e.currentTarget.duration)} onError={()=>setFailed(true)} aria-label={tr('Linked music video')}/>}
  <footer><small role="status" aria-live="off">{tr(message)}</small>{!expanded&&link?.available&&!failed&&<button ref={fullButton} onClick={enterFull}><Icon name="expand"/>{tr('Full screen video')}</button>}</footer>
 </dialog>;
}
export function VideoArtwork({snapshot,prefs,offline=false,onConfigure}){
 const track=snapshot.playback?.queue?.[snapshot.playback.index],[link]=useVideoLink(track);
 return <VideoSurface snapshot={snapshot} prefs={prefs} link={link} offline={offline} onConfigure={onConfigure}/>;
}

export function VideoSettings({snapshot,prefs,update,offline=false,onDirty,actionsRef,onTiming}){
 const track=snapshot.playback?.queue?.[snapshot.playback.index],[link,refresh]=useVideoLink(track),device=useDeviceUpdates();
 const [notice,setNotice]=useState(''),[pending,setPending]=useState(false),[draft,setDraft]=useState(null),[step,setStep]=useState('file');
 const latest=useRef(null),source=useRef(null);latest.current={link,draft,track,token:device?.info?.controlToken};
 const dirty=!!draft&&!!link&&JSON.stringify(draft)!==JSON.stringify(profile(link,prefs));
 useEffect(()=>{onDirty?.(dirty);},[dirty,onDirty]);
 useEffect(()=>{const old=source.current;if(link){source.current=link.trackKey+'|'+link.id+'|'+link.revision;setDraft(profile(link,prefs));if(old&&old!==source.current)setNotice('The track or video changed. Its unsaved timing was discarded.');}else setDraft(null);},[link?.trackKey,link?.id,link?.revision]);
 useEffect(()=>{if(!actionsRef)return;actionsRef.current={save,restore:()=>setDraft({mode:'starts',offsetSeconds:0}),discard:()=>{setDraft(profile(latest.current.link,prefs));setNotice('Changes discarded');}};return()=>{actionsRef.current=null;};},[actionsRef,dirty,link,draft,prefs.correction]);
 async function save(){const current=latest.current;if(!current.link?.available||!current.draft)return true;setPending(true);try{const r=await fetch('/api/video/timing',{method:'POST',headers:{'Content-Type':'application/json','X-TuneBox-Control':current.token||''},body:JSON.stringify({trackKey:current.link.trackKey,id:current.link.id,revision:current.link.revision,sync:current.draft}),signal:AbortSignal.timeout(10000)});const result=await r.json();if(!r.ok)throw Error(result.error);source.current=result.trackKey+'|'+result.id+'|'+result.revision;onDirty?.(false);setNotice('Video timing saved');refresh();return true;}catch(error){setNotice(error.message);return false;}finally{setPending(false);}}
 async function upload(file){
  if(!file)return;if(file.size>96*1024*1024){setNotice('Choose a video smaller than 96 MB.');return;}
  const key=identity(track);setPending(true);setNotice('Uploading video…');
  try{const r=await fetch('/api/video/upload',{method:'POST',headers:{'Content-Type':file.type,'X-TuneBox-Control':device?.info?.controlToken||'','X-TuneBox-Track':link?.trackKey||''},body:file,signal:AbortSignal.timeout(120000)});const v=await r.json();if(!r.ok)throw Error(v.error);if(identity(latest.current.track)!==key){setNotice('Video linked to the previous track. Choose this track’s video separately.');return;}source.current=v.trackKey+'|'+v.id+'|'+v.revision;refresh();setStep('timing');setNotice('Video linked. Adjust timing, then save your settings.');}catch(error){setNotice(error.message);}finally{setPending(false);}
 }
 async function remove(){const current=latest.current;if(!current.link?.available)return;setPending(true);try{const r=await fetch('/api/video',{method:'DELETE',headers:{'X-TuneBox-Control':current.token||'','X-TuneBox-Track':current.link.trackKey,'X-TuneBox-Video':current.link.id}});if(!r.ok)throw Error((await r.json()).error);source.current=null;refresh();setStep('file');setNotice('Video link removed.');}catch(error){setNotice(error.message||'Could not remove the video link.');}finally{setPending(false);}}
 const disabled=offline||pending||!device?.info?.controlToken;
 const changeOffset=value=>setDraft(v=>({...v,offsetSeconds:Math.max(-600,Math.min(600,Math.round(value*1000)/1000))}));
 return <section className="video-settings">
  <p>{tr('Link your own video to a Music Assistant track. Music Assistant keeps playing the audio; TuneBox follows it with silent video.')}</p>
  <article className="video-track"><strong>{track?.title||tr('Select a track first')}</strong><span>{track?.artist}</span></article>
  {onTiming&&<button onClick={onTiming}>{tr('Shared screen and visualizer timing')}</button>}
  <nav className="video-steps" aria-label={tr('Video setup steps')}>{[['file','1 · Choose video'],['timing','2 · Match timing'],['ready','3 · Watch']].map(([id,label])=><button key={id} disabled={id!=='file'&&!link?.available} aria-current={step===id?'step':undefined} onClick={()=>setStep(id)}>{tr(label)}</button>)}</nav>
  {step==='file'&&<><label className="video-upload">{tr(link?.available?'Replace video':'Choose video')}<input aria-label={tr('Choose video')} type="file" accept="video/mp4,video/webm" disabled={disabled||!link||!Number.isFinite(track?.duration)} onChange={e=>{upload(e.target.files?.[0]);e.target.value='';}}/></label><p>{tr('For the Pi 4, start with H.264 MP4 at 720p, 30 fps. Maximum 96 MB per video and 256 MB total.')}</p>{link?.available&&<><p>{tr('A video is linked to this track.')}</p><button onClick={()=>setStep('timing')}>{tr('Adjust video timing')}</button><button onClick={remove} disabled={disabled}>{tr('Remove linked video')}</button></>}</>}
  {step==='timing'&&link?.available&&draft&&<>
   <VideoSurface key={link.url} preview snapshot={snapshot} prefs={prefs} link={{...link,sync:draft}} offline={offline}/>
   <fieldset disabled={disabled} className="video-timing"><legend>{tr('This video only')}</legend><div className="hub-tabs">{[['starts','Match starts'],['ends','Match ends']].map(([mode,label])=><button key={mode} aria-pressed={draft.mode===mode} onClick={()=>setDraft(v=>({...v,mode}))}>{tr(label)}</button>)}</div>
   {link.legacy&&<p>{tr('This video used the previous end alignment. Saving here stores its timing for this track only.')}</p>}
   <label>{tr('Video start correction (seconds)')}<input aria-label={tr('Video start correction')} type="number" min="-600" max="600" step="0.1" value={draft.offsetSeconds} onChange={e=>changeOffset(Number(e.target.value))}/></label>
   <div className="hub-tabs"><button onClick={()=>changeOffset(draft.offsetSeconds-.1)}>{tr('Video back')} −0.1 s</button><button onClick={()=>changeOffset(draft.offsetSeconds+.1)}>{tr('Video forward')} +0.1 s</button><button onClick={()=>setDraft({mode:'starts',offsetSeconds:0})}>{tr('Reset video timing')}</button></div>
   <p>{tr('A positive correction skips forward in the video; a negative correction waits before its first frame. Use Match starts for the same recording, or Match ends when their endings match. Different recordings will not stay synchronized.')}</p>
   <button onClick={()=>setStep('ready')}>{tr('Next: watch')}</button></fieldset>
  </>}
  {step==='ready'&&<><p>{tr('Save your settings, then open Now Playing and enable Video Artwork. Full screen uses the same player and keeps following pause, track changes and seeking.')}</p><p>{translateFormat('Video start correction: {offset} s',{offset:draft?.offsetSeconds||0})}</p><button onClick={()=>update('artwork','video')}>{tr('Enable Video Artwork')}</button></>}
  {!actionsRef&&dirty&&<button disabled={disabled} onClick={save}>{tr('Save video timing')}</button>}
  <p role="status" aria-live="polite">{tr(notice)}</p>
 </section>;
}
