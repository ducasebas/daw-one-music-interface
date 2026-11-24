/**
 * Remote shell for developers. TuneBox never turns SSH on by itself: it only reports the state and changes it
 * when someone confirms the switch in Developer → Services (behind the settings PIN). Open sessions survive
 * turning it off; only new logins are refused.
 */
const units=['ssh.service','ssh.socket'];
export function sshController({run}){
 const state=async unit=>{
  const enabled=(await run('/usr/bin/systemctl',['is-enabled',unit]).catch(e=>e?.stdout||'')).trim();
  const active=(await run('/usr/bin/systemctl',['is-active',unit]).catch(e=>e?.stdout||'')).trim();
  return {enabled,active};
 };
 return {
  async get(){
   const service=await state('ssh.service'),socket=await state('ssh.socket');
   const installed=![service.enabled,socket.enabled].every(v=>v===''||v==='not-found'||/No such file|not-found/.test(v));
   const on=service.active==='active'||socket.active==='active';
   return {supported:installed,enabled:on,startsAtBoot:service.enabled==='enabled'||socket.enabled==='enabled'};
  },
  async set(enabled){
   const current=await this.get();if(!current.supported)throw Error('SSH is not installed on this TuneBox');
   if(enabled)await run('/usr/bin/systemctl',['enable','--now','ssh.service']);
   else for(const unit of units)await run('/usr/bin/systemctl',['disable','--now',unit]).catch(()=>{});
   return {saved:true,...await this.get()};
  },
 };
}
