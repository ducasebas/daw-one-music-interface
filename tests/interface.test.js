import test from 'node:test';
import assert from 'node:assert/strict';
import {relativeTime,settingsAttention,settingsGroups,settingsGroup} from '../shared/interface.js';
test('a check age is concise, relative and does not show a negative future age',()=>{
 const now=Date.UTC(2026,10,12,12);assert.equal(relativeTime(now-179999,now),'3 minutes ago');assert.equal(relativeTime(now+30000,now),'Just now');assert.equal(relativeTime(undefined,now),'Not checked yet');assert.equal(relativeTime(now-60000,now,'nl'),'1 minuut geleden');
});
test('attention routes to the correct grouped settings without inventing mandatory calibration or PIN expiry',()=>{
 assert.equal(settingsGroup('measurement').id,'audio');assert.equal(settingsGroup('presence').id,'display');
 for(const section of ['security','updates','language','developer'])assert.equal(settingsGroup(section).id,'system');
 assert.equal(settingsGroups.length,5);
 const items=settingsAttention({mode:'music-assistant',preferences:{setupCompleted:true},setupStatus:{roomProfile:false},musicAssistant:{connected:true},playback:{connected:true}},{available:{release:'new'}},{enabled:true,unlocked:false});
 assert.deepEqual(items.map(x=>x.section),['updates','security','measurement']);
 assert.ok(!items.some(x=>x.title.includes('PIN expired')));
 assert.deepEqual(settingsAttention(),[]);
});
