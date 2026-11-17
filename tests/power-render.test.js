import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

test('power cards distinguish consumption, negotiated capacity, profiles, unavailable readings and languages',async()=>{
 const dir=resolve('node_modules/.cache/tunebox-power-ssr');mkdirSync(dir,{recursive:true});
 try{
  const outfile=resolve(dir,'power.mjs');
  await build({stdin:{contents:"export {PowerReadouts,PowerMonitoring} from './src/PowerMonitoring.jsx';export {setLanguage} from './shared/i18n.js';",resolveDir:process.cwd(),loader:'jsx'},outfile,bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'},logLevel:'silent'});
  const {PowerReadouts,PowerMonitoring,setLanguage}=await import(pathToFileURL(outfile));
  const React=(await import('react')).default,{renderToStaticMarkup}=await import('react-dom/server');
  const power={observedAt:Date.now(),watts:12.4,volts:20,amps:.62,contractWatts:60,
   ina228:{status:'ok'},pd:{status:'active',volts:20,amps:3,profiles:[{volts:5,amps:3,watts:15},{volts:20,amps:5,watts:100}]}};
  const render=props=>renderToStaticMarkup(React.createElement(PowerReadouts,{power,requiredWatts:100,...props}));
  const connecting=renderToStaticMarkup(React.createElement(PowerMonitoring));assert.match(connecting,/Connecting to the device manager…/);assert.equal((connecting.match(/type="checkbox"[^>]*disabled/g)||[]).length,2);
  const live=render();
  for(const text of ['12.4 W','60 W','100 W','20.00 V','0.620 A','Power supply below requirement','Profiles offered by the power supply'])assert.ok(live.includes(text),text);
  assert.doesNotMatch(live,/<(?:button|select)\b/); // Offered voltage profiles are informational.
  assert.ok(render({power:{...power,watts:0,amps:0}}).includes('0.0 W'));
  for(const props of [{offline:true},{power:{...power,observedAt:Date.now()-7100}},{power:null}]){
   const html=render(props);assert.equal((html.match(/<strong>Unavailable<\/strong>/g)||[]).length,2);assert.doesNotMatch(html,/<strong>(12\.4|60|100) W<\//);assert.doesNotMatch(html,/data-severity="ok"/);
  }
  const good=render({power:{...power,contractWatts:100,pd:{...power.pd,amps:5}}});assert.match(good,/data-severity="ok"/);
  const legacy=render({power:{observedAt:Date.now(),watts:4,volts:20,amps:.2,contractWatts:60,source:'External power telemetry'}});
  assert.match(legacy,/4.0 W/);assert.match(legacy,/External power telemetry/);assert.doesNotMatch(legacy,/INA228|HUSB238/);
  setLanguage('nl');const dutch=render();assert.match(dutch,/Gemeten verbruik/);assert.match(dutch,/Onderhandeld PD-vermogen/);assert.match(dutch,/Voedingsspanning/);assert.doesNotMatch(dutch,/Power supply below requirement/);
  setLanguage('en');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
