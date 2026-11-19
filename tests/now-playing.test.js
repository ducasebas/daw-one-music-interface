import test from 'node:test';
import assert from 'node:assert/strict';
import {widgetText,widgetSelection,widgetCatalog,widgetLimit,backdropSource,nowPlayingWidget,nowPlayingWidgets,sourceQuality} from '../shared/now-playing.js';
const now=Date.UTC(2026,10,19,20,5);
const live={mode:'music-assistant',musicAssistant:{connected:true,players:[{id:'a',available:true},{id:'b',available:true},{id:'c',available:false}]},
 playback:{index:0,playerName:'Living room',sourceFormat:{codec:'flac',sampleRate:44100,bitDepth:16},queue:[{id:'1',title:'Now',artwork:'/api/artwork/'+'a'.repeat(64)},{id:'2',title:'Next song',artist:'Next artist'}]},
 remoteControl:{phones:2,pairing:null},hardwareTelemetry:{temperature:{status:'ok',value:41.26}}};

test('widget choice is bounded, known and unique',()=>{
 assert.deepEqual(widgetSelection(['power','power','nope','clock','wifi','rooms','party']),['power','clock','wifi','rooms']);
 assert.equal(widgetSelection('x').length>0,true);assert.equal(widgetLimit,4);assert.equal(widgetCatalog.length,8);
});
test('the backdrop uses only local artwork and turns static in low-power mode',()=>{
 assert.deepEqual(backdropSource({snapshot:live}).src,'/api/artwork/'+'a'.repeat(64));
 assert.equal(backdropSource({snapshot:{playback:{queue:[{id:'x',artwork:'/api/artwork/../secret'}]}}}).src,null);
 assert.equal(backdropSource({snapshot:live,prefs:{lowPower:true}}).mode,'static');
 assert.equal(backdropSource({snapshot:live,prefs:{backdrop:'off'}}).mode,'off');
 assert.equal(backdropSource({snapshot:live,offline:true}).src,null);
 assert.equal(backdropSource({snapshot:{playback:{queue:[{id:'x',artwork:'https://evil.test/a.jpg'}]}}}).src,null);
});
test('tiles show real readings and say when something is unknown',()=>{
 assert.equal(nowPlayingWidget('upnext',live).value,'Next song');
 assert.equal(nowPlayingWidget('source',live).value,'FLAC · 44.1 kHz · 16-bit');
 assert.equal(sourceQuality({codec:'mp3',sampleRate:48000}),'MP3 · 48 kHz');
 {const r=nowPlayingWidget('rooms',live);assert.equal(widgetText(r.value,r.params),'2 rooms');}
 assert.equal(nowPlayingWidget('temperature',live).value,'41.3 °C');
 {const r=nowPlayingWidget('party',live);assert.equal(widgetText(r.value,r.params),'2 phones');}
 assert.equal(nowPlayingWidget('wifi',live,{network:{connected:true,signal:72.4,ssid:'Home'}}).value,'72%');
 assert.equal(nowPlayingWidget('clock',live,{now}).value.length,5);
 for(const id of ['upnext','source','rooms','temperature','wifi','power'])assert.equal(nowPlayingWidget(id,live,{offline:true}).available,false,id);
 assert.equal(nowPlayingWidget('source',{...live,playback:{...live.playback,sourceFormat:null}}).available,false);
 assert.equal(nowPlayingWidget('upnext',{...live,playback:{...live.playback,queue:[live.playback.queue[0]]}}).value,'End of queue');
 assert.equal(nowPlayingWidgets(['clock','power'],live,{now}).length,2);
});
test('power never shows consumption without a confirmed reading, and never invents a contract',()=>{
 const fresh=p=>({...live,hostTelemetry:{power:{observedAt:now-1000,source:'INA228 + HUSB238',...p}}});
 assert.equal(nowPlayingWidget('power',live,{now}).available,false,'no telemetry');
 const contractOnly=nowPlayingWidget('power',fresh({watts:null,contractWatts:60}),{now});
 assert.equal(widgetText(contractOnly.value,contractOnly.params),'60 W contract');assert.equal(contractOnly.detail,'Consumption needs verified wiring');
 const both=nowPlayingWidget('power',fresh({watts:23.46,contractWatts:60}),{now});assert.equal(widgetText(both.value,both.params),'23.5 W in use');assert.equal(widgetText(both.detail,both.params),'60 W contract');
 assert.equal(nowPlayingWidget('power',fresh({watts:null,contractWatts:null}),{now}).available,false);
 assert.equal(nowPlayingWidget('power',fresh({watts:20,contractWatts:60,observedAt:now-60000}),{now}).available,false,'stale readings are not shown');
});
