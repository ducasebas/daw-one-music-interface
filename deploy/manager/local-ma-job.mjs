import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {atomicJson} from './io.mjs';
const path='/var/lib/daw-one-manager/local-ma.json';
let target='unknown';try{target=readFileSync('/opt/daw-one/deployment-target','utf8').trim();}catch{}
if(target!=='pi4'){atomicJson(path,{phase:'unavailable',observedAt:Date.now()});process.exit(1);}
atomicJson(path,{phase:'installing',observedAt:Date.now()});
const child=spawn('/bin/bash',['/usr/local/lib/daw-one-control/deploy/music-assistant-local.sh','--install',target],{stdio:'ignore'});
child.once('error',()=>{atomicJson(path,{phase:'failed',observedAt:Date.now()});process.exitCode=1;});
child.once('exit',code=>{atomicJson(path,{phase:code===0?'ready':'failed',observedAt:Date.now()});process.exitCode=code===0?0:1;});
