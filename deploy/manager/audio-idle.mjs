import {readFileSync} from 'node:fs';
/** Used only for first-use Bluetooth without a configured MA connection. */
export function playbackHardwareIdle(read=path=>readFileSync(path,'utf8')){
  let pcm;try{pcm=read('/proc/asound/pcm');}catch{return false;}
  const entries=pcm.split('\n').slice(0,64).map(line=>line.match(/^(\d{2})-(\d{2}): .*playback \d+/)).filter(Boolean);
  if(!entries.length)return false;
  for(const m of entries){try{const state=read(`/proc/asound/card${Number(m[1])}/pcm${Number(m[2])}p/sub0/status`);if(!/^closed\s*$|^state:\s+(?:OPEN|SETUP|PREPARED)\s*$/m.test(state))return false;}catch{return false;}}
  return true;
}
