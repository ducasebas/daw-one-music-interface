import React,{useEffect,useState} from 'react';
export function UpdateSettings(){
 const [info,setInfo]=useState(null);
 useEffect(()=>{let active=true;const read=()=>fetch('/api/updates').then(r=>{if(!r.ok)throw Error();return r.json();}).then(v=>{if(active)setInfo(v);}).catch(()=>{if(active)setInfo({status:'offline'});});read();const timer=setInterval(read,15000);return()=>{active=false;clearInterval(timer);};},[]);
 return <div className="control-grid" aria-live="polite"><section><h3>Software updates</h3><p>{info?.status||'Checking…'}</p><p>Channel: {info?.channel||'Not configured'}</p><p>Commit: {info?.commit?.slice(0,8)||'—'}</p></section><section><h3>Signed releases</h3><p>Configured devices check every 15 minutes. Playback postpones installation.</p><p>Enable once through SSH using the installation guide. Updates do not enable unverified hardware.</p></section></div>;
}
