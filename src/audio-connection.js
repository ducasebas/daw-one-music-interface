/** Local analysis frames use one live feed; HTTP remains the compatible, bounded fallback. */
export function connectAudio({active=true,paused=false,spectrum=true,onAudio},environment=globalThis){
 const document=environment.document,now=()=>environment.performance?.now?.()??environment.Date.now();
 const requests=new Map();
 let stopped=false,epoch=0,watch=true,stream=null,pollTimer=null,renewTimer=null,deadline=null,watchdog=null,retryAt=0,lastMessage=0,latest=null;
 const watchUrl=()=>'/api/audio?watch=1'+(spectrum?'':'&spectrum=0');
 const emit=value=>{latest=typeof value.enabled==='boolean'?value:{...latest,...value};onAudio(latest);};
 const allowed=value=>value?.enabled===true&&value?.configured===true&&(!paused||value.matchesSelected===false);
 const current=own=>!stopped&&epoch===own&&active&&!document?.hidden;
 function abortRequests(){for(const [controller,timer] of requests){environment.clearTimeout(timer);controller.abort();}requests.clear();}
 async function read(path){
  const controller=new environment.AbortController(),timer=environment.setTimeout(()=>controller.abort(),2000);requests.set(controller,timer);
  try{const response=await environment.fetch(path,{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('Audio status unavailable');return await response.json();}
  finally{environment.clearTimeout(timer);requests.delete(controller);}
 }
 function closeStream(){
  stream?.close();stream=null;
  environment.clearTimeout(renewTimer);environment.clearTimeout(deadline);environment.clearInterval(watchdog);renewTimer=deadline=watchdog=null;
 }
 function schedule(delay){environment.clearTimeout(pollTimer);pollTimer=environment.setTimeout(poll,delay);}
 function failedStream(ownStream){
  if(stream!==ownStream||stopped)return;
  closeStream();abortRequests();retryAt=now()+15000;schedule(0);
 }
 function openStream(own){
  let connection;try{connection=new environment.EventSource('/api/audio/events');}catch{retryAt=now()+15000;schedule(100);return;}
  stream=connection;lastMessage=now();
  const renew=async()=>{
   if(!current(own)||stream!==connection)return;
   try{
    // This small heartbeat renews the existing three-second reader lease. A frozen
    // or hidden browser cannot keep native capture alive merely by leaving SSE open.
    const value=await read(watchUrl());
    if(!current(own)||stream!==connection)return;
    if(!allowed(value)){emit(value);closeStream();watch=false;schedule(2000);return;}
    renewTimer=environment.setTimeout(renew,1500);
   }catch{if(current(own))failedStream(connection);}
  };
  connection.onmessage=event=>{
   if(!current(own)||stream!==connection)return;
   try{
    if(event.data.length>16384)throw Error('Oversized audio frame');
    const value=JSON.parse(event.data);if(!value||Array.isArray(value)||typeof value.status!=='string')throw Error('Invalid audio frame');
    lastMessage=now();environment.clearTimeout(deadline);deadline=null;emit(value);
    if(!allowed(value)){closeStream();watch=false;schedule(2000);}
   }catch{failedStream(connection);}
  };
  connection.onerror=()=>failedStream(connection);
  deadline=environment.setTimeout(()=>failedStream(connection),2500);
  watchdog=environment.setInterval(()=>{if(now()-lastMessage>3500)failedStream(connection);},1000);
  renewTimer=environment.setTimeout(renew,1500);
 }
 async function poll(){
  const own=epoch;pollTimer=null;if(!current(own))return;
  try{
   const value=await read(watch?watchUrl():'/api/audio');if(!current(own))return;
   emit(value);watch=!paused||value.matchesSelected===false;
   if(allowed(value)&&value.streamUrl==='/api/audio/events'&&typeof environment.EventSource==='function'&&now()>=retryAt){openStream(own);return;}
   schedule(allowed(value)?100:2000);
  }catch{if(current(own)){emit({status:'offline',measurement:null});schedule(2000);}}
 }
 function refresh(){
  epoch++;environment.clearTimeout(pollTimer);closeStream();abortRequests();watch=true;
  if(stopped)return;
  if(!active||document?.hidden){emit({status:'hidden',measurement:null});return;}
  poll();
 }
 document?.addEventListener('visibilitychange',refresh);refresh();
 return {refresh,setSpectrum(value){spectrum=value!==false;},stop(){stopped=true;epoch++;environment.clearTimeout(pollTimer);closeStream();abortRequests();document?.removeEventListener('visibilitychange',refresh);}};
}
