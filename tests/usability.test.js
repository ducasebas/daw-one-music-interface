import test from 'node:test';
import assert from 'node:assert/strict';
import {deviceActionMessage} from '../shared/device-feedback.js';
import {translate} from '../shared/i18n.js';
import {createProgressServer} from '../deploy/manager/progress-server.mjs';

test('foreground hardware actions explain the wait while background status reads stay quiet',()=>{
 for(const command of ['power-discover-20v','power-request-max20v','power-config','wifi-scan','hotspot-start','hotspot-stop','dsp-set','sync-start','local-ma-install','power-off']){
  const message=deviceActionMessage(command);assert.ok(message.endsWith('…'));assert.notEqual(message,command);
  assert.notEqual(translate(message,'nl'),message);
 }
 for(const command of ['power-status','network','dsp','clock','sync-status','measurement-status','local-ma-status'])assert.equal(deviceActionMessage(command),null);
 assert.equal(deviceActionMessage('future-confirmed-action'),'Working…');
});
test('restart copy describes persistence without promising an unchanged adapter wattage',()=>{
 assert.equal(translate('Keep these settings after restart','nl'),'Bewaar deze instellingen na opnieuw opstarten');
 const key='After restarting, TuneBox checks the adapter again and uses the highest available power at 20 V. The wattage can change if you use a different adapter or cable.';
 assert.match(translate(key,'en'),/wattage can change/);assert.match(translate(key,'nl'),/wattage veranderen/);
});
test('the independent update page has its cursor boundary in HTML before JavaScript runs',async()=>{
 const server=createProgressServer({getStatus:()=>({status:'installing'}),isAppReady:async()=>false});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const origin='http://127.0.0.1:'+server.address().port;
  const kiosk=await(await fetch(origin+'/?display=dsi-production')).text();
  assert.match(kiosk,/^<!doctype html><html[^>]*data-tunebox-kiosk="true"/);
  assert.ok(kiosk.indexOf('data-tunebox-kiosk="true"')<kiosk.indexOf('/appliance.js'));
  assert.doesNotMatch(kiosk,/__TUNEBOX_DISPLAY_ATTRIBUTE__/);
  const desktop=await(await fetch(origin+'/?display=hdmi-development')).text();
  assert.doesNotMatch(desktop.slice(0,desktop.indexOf('>')+1),/data-tunebox-kiosk/);
  const invalid=await(await fetch(origin+'/?display='+encodeURIComponent('dsi-production"><img src=x>'))).text();
  assert.doesNotMatch(invalid,/<img src=x>/);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('Install update is not disabled by unrelated background device activity',async()=>{
  const {readFileSync}=await import('node:fs');
  const install=readFileSync(new URL('../src/InstallUpdate.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(install,/disabled=\{[^}]*pending/);
  for(const file of ['../src/UpdateSettings.jsx','../src/LegacyUpdateSettings.jsx']){const s=readFileSync(new URL(file,import.meta.url),'utf8');assert.match(s,/<InstallUpdate disabled=\{!installable/);assert.doesNotMatch(s.match(/const installable=[^;]*;/)[0],/pending/);}
});
