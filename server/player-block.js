import {readFileSync} from 'node:fs';
import {readPowerFile} from './power-telemetry.js';

/**
 * The opt-in PD startup guard keeps the local player stopped until power is verified.
 * Surface that on screen: it otherwise looks like a Music Assistant outage.
 * Only reported for this boot, and only while the local player is actually missing.
 */
export function playerStartupBlock({startup,bootId,localVisible}){
 if(localVisible!==false||!startup||typeof startup!=='object'||startup.status!=='error'||startup.qualified===true)return null;
 if(typeof bootId!=='string'||startup.bootId!==bootId)return null;
 const reason=typeof startup.error==='string'?startup.error.replace(/[\x00-\x1f\x7f]/g,' ').slice(0,160):'';
 return {reason:reason||'Power setup did not complete'};
}
export function readPlayerStartupBlock(localVisible){
 let startup=null,bootId='';
 try{const raw=readPowerFile('/run/daw-one-pd/startup.json');if(raw)startup=JSON.parse(raw);}catch{}
 try{bootId=readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim();}catch{}
 return playerStartupBlock({startup,bootId,localVisible});
}
