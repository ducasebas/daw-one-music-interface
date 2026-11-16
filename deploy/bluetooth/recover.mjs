import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {bluetoothController} from '../manager/bluetooth.mjs';
const exec=promisify(execFile),run=async(p,a)=>(await exec(p,a,{timeout:15000,maxBuffer:32768,env:{...process.env,LC_ALL:'C'}})).stdout;
try{await bluetoothController({run}).stop({restartPlayers:false});}catch{console.error('Bluetooth gain restore failed; the player remains blocked until audio restoration is reviewed.');process.exitCode=1;}
