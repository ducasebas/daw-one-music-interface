/** Shared navigation and attention rules for the physical music appliance. */
export const settingsSections = [
  ['playback','Playback','play',0],['audio','Audio & DSP','volume',14],
  ['measurement','Room measurement','speaker',23],['video','Video','film',16],
  ['display','Display','sun',15],['presence','Presence','rooms',19],
  ['appearance','Appearance','discover',1],['connections','Connections','wifi',13],
  ['system','System','settings',11],['sensors','Sensors','temperature',17],
  ['security','Security','lock',21],['updates','Updates','update',12],
  ['date','Date & time','clock',20],['language','Language','language',18],
  ['developer','Developer','settings',22],
];
export const settingsGroups = [
  {id:'playback',title:'Playback',icon:'play',sections:['playback']},
  {id:'audio',title:'Audio & DSP',icon:'volume',sections:['audio','measurement','video']},
  {id:'display',title:'Display',icon:'sun',sections:['display','presence','appearance']},
  {id:'connections',title:'Connections',icon:'wifi',sections:['connections']},
  {id:'system',title:'System',icon:'settings',sections:['system','sensors','security','updates','date','language','developer']},
];
export const settingsGroup = id => settingsGroups.find(g=>g.sections.includes(id));
export function settingsAttention(snapshot={},updates={},security={}) {
  const items=[];
  if(updates.available)items.push({id:'update',section:'updates',title:'Update available',detail:updates.available.release,icon:'update'});
  if(updates.status==='error')items.push({id:'update-error',section:'updates',title:'Update needs attention',detail:updates.error||'Open Updates to retry.',icon:'alert'});
  if(security.enabled&&!security.unlocked)items.push({id:'unlock',section:'security',title:'Unlock settings',detail:'Your settings session has ended. Music remains available.',icon:'lock'});
  if(snapshot.onboardingRequired||updates.manager?.managed&&!updates.manager?.simulated&&updates.manager.setupComplete===false)items.push({id:'setup',section:'connections',title:'Complete setup',detail:'Connect Music Assistant and choose your player.',icon:'wifi'});
  if(snapshot.mode==='music-assistant'&&(!snapshot.musicAssistant?.connected||!snapshot.playback?.connected))items.push({id:'music',section:'connections',title:'Check Music Assistant',detail:'The music server or selected player is unavailable.',icon:'speaker'});
  if(snapshot.device?.faults?.length)items.push({id:'hardware',section:'sensors',title:'Hardware alert',detail:snapshot.device.faults.join(', '),icon:'alert'});
  // Optional measurements are suggestions, never faults or mandatory calibration.
  if(snapshot.mode==='music-assistant'&&snapshot.preferences?.setupCompleted&&snapshot.setupStatus?.roomProfile===false)items.push({id:'room-setup',section:'measurement',title:'Set up room and speakers',detail:'Add room dimensions and speaker positions in Audio & DSP.',icon:'speaker'});
  if(snapshot.preferences?.audioEnabled&&snapshot.setupStatus?.audioConfigured===false)items.push({id:'audio',section:'audio',title:'Set up audio analysis',detail:'The PCM reader needs installation.',icon:'volume'});
  return items;
}
export function relativeTime(timestamp,now=Date.now(),language='en') {
  const value=typeof timestamp==='number'?timestamp:Date.parse(timestamp);
  if(!Number.isFinite(value))return language==='nl'?'Nog niet gecontroleerd':'Not checked yet';
  const seconds=Math.max(0,(now-value)/1000);
  if(seconds<60)return language==='nl'?'Zojuist':'Just now';
  const unit=seconds<3600?'minute':seconds<86400?'hour':'day';
  return new Intl.RelativeTimeFormat(language==='nl'?'nl':'en',{numeric:'auto'}).format(-Math.round(seconds/({minute:60,hour:3600,day:86400}[unit])),unit);
}
