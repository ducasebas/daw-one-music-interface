import {tr} from "../shared/i18n.js";
import {Modal} from './Modal.jsx';
import {Icon} from './Icon.jsx';
import React,{useEffect,useRef,useState} from 'react';
import {useDeviceUpdates} from './DeviceUpdates.jsx';
import {endSync} from '../shared/video.js';
function useVideoLink(track){
  const [link,setLink]=useState(null),[revision,setRevision]=useState(0);
  useEffect(()=>{let live=true;const controller=new AbortController();setLink(null);fetch('/api/video',{signal:controller.signal,cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(v=>{if(live)setLink(v);}).catch(()=>{});return()=>{live=false;controller.abort();};},[track?.id,track?.title,track?.artist,revision]);
  return [link,()=>setRevision(v=>v+1)];
}
export function VideoArtwork({snapshot,position,prefs,offline=false,onConfigure,fullscreen=false}){
  const track=snapshot.playback?.queue[snapshot.playback.index], [link]=useVideoLink(track),ref=useRef(null),[duration,setDuration]=useState(null),[failed,setFailed]=useState(false),[expanded,setExpanded]=useState(false);
  useEffect(()=>{setFailed(false);setDuration(null);},[link?.url]);
  useEffect(()=>{
    const video=ref.current;if(!video||!Number.isFinite(duration))return;
    if(expanded||snapshot.device.displayAwake===false){video.pause();return;}
    const sync=endSync({audioPosition:position,audioDuration:track?.duration,videoDuration:duration,correction:prefs.correction,playing:snapshot.playback.playing,available:!offline,matched:true});
    if(sync.status==='fallback'){video.pause();return;}
    if(Math.abs(video.currentTime-sync.position)>.5)video.currentTime=sync.position;
    if(sync.playing)video.play().catch(()=>setFailed(true));else video.pause();
  },[position,snapshot.playback.playing,snapshot.device.displayAwake,track?.duration,duration,prefs.correction,offline,expanded]);
  if(!link?.available||failed)return <section className="video-unavailable"><strong>{tr(failed?'Video could not play':'No video linked to this track')}</strong><p>{tr("Link your own MP4 or WebM in Video settings.")}</p>{onConfigure&&<button onClick={onConfigure}>{tr("Video settings")}</button>}</section>;
  return <section className="video-artwork" aria-label={tr("Video artwork")}><video ref={ref} src={link.url} muted playsInline preload="metadata" onLoadedMetadata={e=>setDuration(e.currentTarget.duration)} onError={()=>setFailed(true)} aria-label={tr("Linked music video")}/><small>{tr("Video synced to Music Assistant · muted")}</small>{!fullscreen&&<button onClick={()=>setExpanded(true)}>{tr('Full screen video')}</button>}{expanded&&<Modal label="Full screen video" className="video-fullscreen" onCancel={()=>setExpanded(false)}><VideoArtwork snapshot={snapshot} position={position} prefs={prefs} offline={offline} fullscreen/><button className="video-fullscreen-close" onClick={()=>setExpanded(false)}><Icon name="close"/>{tr('Back to music')}</button></Modal>}</section>;
}
export function VideoSettings({snapshot,prefs,update,offline=false}){
  const track=snapshot.playback?.queue[snapshot.playback.index], [link,refresh]=useVideoLink(track),device=useDeviceUpdates(),[notice,setNotice]=useState(''),[pending,setPending]=useState(false);
  async function upload(file){
    if(!file)return;if(file.size>96*1024*1024){setNotice('Choose a video smaller than 96 MB.');return;}
    setPending(true);setNotice('Uploading video…');
    try{const r=await fetch('/api/video/upload',{method:'POST',headers:{'Content-Type':file.type,'X-TuneBox-Control':device?.info?.controlToken||''},body:file});const v=await r.json();if(!r.ok)throw Error(v.error);refresh();setNotice('Video linked. Open Now Playing and turn on Video Artwork.');}catch(error){setNotice(error.message);}finally{setPending(false);}
  }
  async function remove(){try{const r=await fetch('/api/video',{method:'DELETE',headers:{'X-TuneBox-Control':device?.info?.controlToken||''}});if(!r.ok)throw Error();refresh();setNotice('Video link removed.');}catch{setNotice('Could not remove the video link.');}}
  return <section className="video-settings"><p>{tr("Link a video to the current track. It plays silently and follows the music position, pause and seek.")}</p><article className="video-track"><strong>{track?.title}</strong><span>{track?.artist}</span></article><label className="video-upload">{tr("Choose video")}<input aria-label={tr("Choose video")} type="file" accept="video/mp4,video/webm" disabled={offline||pending||!device?.info?.controlToken||!Number.isFinite(track?.duration)} onChange={e=>{upload(e.target.files?.[0]);e.target.value='';}}/></label><label>{tr("Video sync correction (seconds)")}<input aria-label={tr("Video sync correction")} type="number" min="-600" max="600" value={prefs.correction} onChange={e=>update('correction',Number(e.target.value))}/></label>{link?.available&&<><video className="video-preview" src={link.url} muted playsInline preload="metadata"/><p>{tr('Preview and full screen playback are available from Now Playing.')}</p><button onClick={remove} disabled={pending||offline}>{tr("Remove linked video")}</button></>}<p role="status">{tr(notice)}</p><small>{tr("MP4/H.264 is recommended for the Pi. Maximum 96 MB per video, 256 MB total. Automatic Spotify, Tidal or YouTube video matching is not connected.")}</small></section>;
}
