import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RoomSelection} from '../server/room-selection.js';
import {atomicJson} from '../deploy/manager/io.mjs';

const context={serverUrl:'ws://music.local/ws',localId:'tb',fallbackId:'everywhere'};
function fixture(t){const directory=mkdtempSync(join(tmpdir(),'tunebox-selection-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));return directory;}

test('without a saved choice a boot starts with the local output, not the configured group',t=>{
 const store=new RoomSelection({directory:fixture(t),currentBoot:'boot-1'});
 assert.equal(store.initial(context),'tb');
 assert.equal(store.initial({...context,localId:null}),'everywhere');
});
test('an intentional remote room survives an app restart within the same boot',t=>{
 const directory=fixture(t),first=new RoomSelection({directory,currentBoot:'boot-1'});
 assert.equal(first.save(context,'rivo'),true);
 assert.equal(new RoomSelection({directory,currentBoot:'boot-1'}).initial(context),'rivo');
});
test('a real reboot chooses the local output and ignores the previous boot group',t=>{
 const directory=fixture(t);new RoomSelection({directory,currentBoot:'boot-1'}).save(context,'everywhere');
 assert.equal(new RoomSelection({directory,currentBoot:'boot-2'}).initial(context),'tb');
});
test('a changed Music Assistant server or local hardware identity cannot restore the old room',t=>{
 const directory=fixture(t);new RoomSelection({directory,currentBoot:'boot-1'}).save(context,'rivo');
 const again=new RoomSelection({directory,currentBoot:'boot-1'});
 assert.equal(again.initial({...context,serverUrl:'ws://another.local/ws'}),'tb');
 assert.equal(again.initial({...context,localId:'another-tb'}),'another-tb');
});
test('invalid, unrelated or malformed persisted choices fall back to the local output',t=>{
 const directory=fixture(t),store=new RoomSelection({directory,currentBoot:'boot-1'});store.save(context,'rivo');
 const path=join(directory,'rooms-selection.json'),valid=JSON.parse(readFileSync(path));
 for(const value of [{...valid,schema:2},{...valid,playerId:{}},{...valid,playerId:'x'.repeat(201)},{...valid,playerId:'bad\nvalue'},[],null]){
  writeFileSync(path,JSON.stringify(value));assert.equal(new RoomSelection({directory,currentBoot:'boot-1'}).initial(context),'tb');
 }
 writeFileSync(path,'{invalid');assert.equal(new RoomSelection({directory,currentBoot:'boot-1'}).initial(context),'tb');
});
test('saving the same selection does not repeatedly write or sync the SD card',t=>{
 let writes=0;const store=new RoomSelection({directory:fixture(t),currentBoot:'boot-1',write:(path,value)=>{writes++;atomicJson(path,value);}});
 assert.equal(store.save(context,'tb'),true);assert.equal(store.save(context,'tb'),true);assert.equal(writes,1);
 store.save(context,'rivo');assert.equal(writes,2);
});
test('selection persistence contains no server credentials and uses a private file',t=>{
 const directory=fixture(t),store=new RoomSelection({directory,currentBoot:'boot-1'});
 store.save({...context,serverUrl:'ws://private-user:private-password@music.local/ws'},'rivo');
 const path=join(directory,'rooms-selection.json'),raw=readFileSync(path,'utf8');
 assert.equal(statSync(path).mode&0o777,0o600);
 for(const privateValue of ['private-user','private-password','music.local'])assert.equal(raw.includes(privateValue),false);
});
test('an unavailable state directory or unknown boot never prevents using the player',t=>{
 const directory=fixture(t),store=new RoomSelection({directory,currentBoot:'boot-1',write:()=>{throw Error('No space');}});
 assert.equal(store.save(context,'rivo'),false);assert.equal(store.initial(context),'tb');
 const unknown=new RoomSelection({directory,currentBoot:null});assert.equal(unknown.save(context,'rivo'),false);assert.equal(unknown.initial(context),'tb');
});
