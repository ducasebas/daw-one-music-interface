/** Prefer live snapshots; HTTP is a bounded fallback, never a parallel feed. */
export function connectState({onSnapshot,onOffline}, environment=globalThis) {
  const {window=environment,navigator,document}=environment;
  const now=()=>environment.performance?.now?.()??environment.Date.now();
  let stopped=false,live=false,lastMessage=0,epoch=0,controller=null;
  const stream=new environment.EventSource('/api/events');
  const online=()=>navigator.onLine!==false;
  const poll=async()=>{
    if(stopped||controller)return;
    if(!online()){onOffline(true);return;}
    const requestEpoch=epoch;
    const request=new environment.AbortController();controller=request;
    const timeout=environment.setTimeout(()=>request.abort(),4000);
    try{
      const response=await environment.fetch('/api/state',{cache:'no-store',signal:request.signal});
      if(!response.ok)throw Error('State unavailable');
      const value=await response.json();
      if(!stopped&&online()&&requestEpoch===epoch){onSnapshot(value);onOffline(false);}
    }catch{
      if(!stopped&&requestEpoch===epoch)onOffline(true);
    }finally{
      environment.clearTimeout(timeout);
      if(controller===request)controller=null;
    }
  };
  stream.onmessage=event=>{
    if(stopped||!online())return;
    try{
      const value=JSON.parse(event.data);
      live=true;lastMessage=now();epoch++;
      onSnapshot(value);onOffline(false);
    }catch{}
  };
  stream.onerror=()=>{live=false;poll();};
  const tick=()=>{
    if(!live||now()-lastMessage>20000)poll();
  };
  const offline=()=>{live=false;epoch++;controller?.abort();onOffline(true);};
  const resume=()=>{if(document?.hidden)return;live=false;poll();};
  window.addEventListener('offline',offline);
  window.addEventListener('online',resume);
  document?.addEventListener('visibilitychange',resume);
  const timer=environment.setInterval(tick,1500);
  poll();
  return ()=>{
    stopped=true;epoch++;controller?.abort();stream.close();
    environment.clearInterval(timer);
    window.removeEventListener('offline',offline);
    window.removeEventListener('online',resume);
    document?.removeEventListener('visibilitychange',resume);
  };
}
