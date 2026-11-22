import test from 'node:test';
import assert from 'node:assert/strict';
import {screenOffDue,screenOffChoices} from '../shared/screen-off.js';
import {displaySettings,displayDefaults} from '../shared/display-settings.js';

const display=displaySettings({timeoutSeconds:120,offAfterSeconds:900});
test('screen turns off only after rest plus the chosen time without touch',()=>{
  assert.equal(screenOffDue({display,displayAwake:false,idleMs:120e3+899e3}),false);
  assert.equal(screenOffDue({display,displayAwake:false,idleMs:120e3+900e3}),true);
  assert.equal(screenOffDue({display,displayAwake:true,idleMs:9e9}),false,'never while the display is awake');
});
test('music keeps the screen on unless the owner allows otherwise',()=>{
  assert.equal(screenOffDue({display,displayAwake:false,idleMs:9e9,playing:true}),false);
  assert.equal(screenOffDue({display:{...display,offWhilePlaying:true},displayAwake:false,idleMs:9e9,playing:true}),true);
});
test('Never disables it and old saved settings get the default',()=>{
  assert.equal(screenOffDue({display:{...display,offAfterSeconds:0},displayAwake:false,idleMs:9e9}),false);
  assert.equal(displaySettings({timeoutSeconds:600}).offAfterSeconds,displayDefaults.offAfterSeconds);
  assert.ok(screenOffChoices.includes(displayDefaults.offAfterSeconds));
  assert.throws(()=>displaySettings({offAfterSeconds:42}));
  assert.throws(()=>displaySettings({offWhilePlaying:'yes'}));
});
