import {readFileSync} from 'node:fs';
export function presenceReading(value,policy,clock,now=Date.now()){
 const timestamp=value?.observedAt;
 if(value?.schema!==1||!Number.isFinite(timestamp)||timestamp>now+1000||now-timestamp>3000||typeof value.present!=='boolean'||!Number.isFinite(value.distance)||value.distance<0||value.distance>10||!Number.isFinite(value.energy)||value.energy<0||value.energy>100)return {status:'unavailable',present:false,simulated:false};
 const hour=new Intl.DateTimeFormat('en-GB',{timeZone:clock.timeZone,hour:'2-digit',minute:'2-digit',hour12:false}).format(now),night=policy.nightEnabled&&(policy.nightStart===policy.nightEnd||(policy.nightStart<policy.nightEnd?hour>=policy.nightStart&&hour<policy.nightEnd:hour>=policy.nightStart||hour<policy.nightEnd));
 const threshold={low:60,medium:35,high:15}[policy.sensitivity];
 return {status:policy.enabled?'ok':'disabled',present:policy.enabled&&!night&&value.present&&value.distance<=policy.maximumDistance&&value.energy>=threshold,distance:value.distance,energy:value.energy,observedAt:timestamp,night,source:'Seeed HSP24 · software detection filter',simulated:false};
}
export class PresencePolicy{
 constructor(path='/run/daw-one-presence/readings.json'){this.path=path;this.present=false;this.absentSince=null;this.value={status:'unavailable',present:false,simulated:false};}
 tick(settings,runtime,now=Date.now()){
  let raw;try{const value=readFileSync(this.path,'utf8');if(value.length<4096)raw=JSON.parse(value);}catch{}
  const value=presenceReading(raw,settings.presence,settings.clock,now);this.value=value;
  if(value.status!=='ok'){this.present=false;this.absentSince=null;return;}
  if(value.present){if(!this.present)runtime.dispatch({type:'activity'},now);runtime.lastActivity=now;this.absentSince=null;}
  else{if(this.absentSince===null)this.absentSince=now;if(now-Math.max(this.absentSince,runtime.lastActivity)>settings.presence.absenceSeconds*1000&&runtime.device.displayAwake)runtime.dispatch({type:'display-timeout'},now);}
  this.present=value.present;
 }
}
