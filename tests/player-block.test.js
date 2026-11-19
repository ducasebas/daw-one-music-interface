import test from 'node:test';
import assert from 'node:assert/strict';
import {playerStartupBlock} from '../server/player-block.js';
const failed={status:'error',phase:'failed',qualified:false,bootId:'boot-1',error:'Automatic PD setup is blocked; complete power setup manually'};
test('a failed PD startup is shown only for this boot and only while the local player is missing',()=>{
 assert.deepEqual(playerStartupBlock({startup:failed,bootId:'boot-1',localVisible:false}),{reason:failed.error});
 assert.equal(playerStartupBlock({startup:failed,bootId:'boot-2',localVisible:false}),null,'stale boot');
 assert.equal(playerStartupBlock({startup:failed,bootId:'boot-1',localVisible:true}),null,'player is running');
 assert.equal(playerStartupBlock({startup:failed,bootId:'boot-1',localVisible:null}),null,'unknown is not claimed');
 assert.equal(playerStartupBlock({startup:{...failed,status:'ready',qualified:true},bootId:'boot-1',localVisible:false}),null);
 assert.equal(playerStartupBlock({startup:{...failed,error:'x\u0000y'.repeat(100)},bootId:'boot-1',localVisible:false}).reason.length,160);
});
