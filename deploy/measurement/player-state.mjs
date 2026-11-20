import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFileSync,rmSync} from 'node:fs';
import {dspController} from '../manager/dsp.mjs';
import {atomicJson,readJson} from '../manager/io.mjs';
import {prepareMeasurement,restoreMeasurement} from './session.mjs';
const execute=promisify(execFile),path='/var/lib/daw-one-manager/measurement-restore.json';
const run=async(program,args)=>(await execute(program,args,{timeout:12000,encoding:'utf8',maxBuffer:32768})).stdout;
const options={run,dsp:dspController({run}),read:()=>readJson(path,null),write:v=>atomicJson(path,v),clear:()=>rmSync(path,{force:true}),output:readJson('/etc/daw-one/measurement.json',{}).output,verifyCorrection:readJson('/var/lib/daw-one-measurement/request.json',{}).verifyCorrection===true};
try{
 if(process.argv[2]==='prepare')await prepareMeasurement(options);
 else if(process.argv[2]==='restore'){
  // Also clean after SIGKILL/timeout, where the worker's finally block cannot run.
  for(const file of ['sweep.wav','capture.raw'])rmSync('/var/lib/daw-one-measurement/'+file,{force:true});
  await restoreMeasurement(options);
 }else throw Error('Unknown measurement action');
}catch(error){console.error('Audio restoration or preparation failed; review the local measurement service and restore journal before playing. Reason: '+String(error?.message||error).slice(0,200));process.exitCode=1;}
