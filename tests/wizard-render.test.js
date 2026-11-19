import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

test('setup renders additive choices, owned controls, finish/skip routes and accessible independent wizard steps',async()=>{
 const dir=resolve('node_modules/.cache/tunebox-wizard-ssr');mkdirSync(dir,{recursive:true});
 try{
  const outfile=resolve(dir,'journeys.mjs');
  await build({stdin:{contents:"export {FirstStartWizard} from './src/FirstStartWizard.jsx';export {SetupCards} from './src/SetupJourneys.jsx';export {WizardShell} from './src/WizardShell.jsx';export {DeviceUpdatesProvider} from './src/DeviceUpdates.jsx';export {setLanguage} from './shared/i18n.js';",resolveDir:process.cwd(),loader:'jsx'},outfile,bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'},logLevel:'silent'});
  const m=await import(pathToFileURL(outfile));const React=(await import('react')).default,{renderToStaticMarkup}=await import('react-dom/server');
  const render=element=>renderToStaticMarkup(React.createElement(m.DeviceUpdatesProvider,null,element));
  const welcome=render(React.createElement(m.FirstStartWizard,{snapshot:{mode:'simulation',preferences:{maxVolume:40}},offline:true,onComplete(){}}));
  assert.match(welcome,/First start setup/);assert.match(welcome,/Finish later/);assert.match(welcome,/Skip for now/);assert.match(welcome,/combine Wi-Fi, Ethernet, Bluetooth and Music Assistant/);assert.doesNotMatch(welcome,/<input[^>]+type="password"/);
  const cards=render(React.createElement(m.SetupCards,{snapshot:{bluetooth:{supported:true}},onOpen(){}}));for(const label of ['Wi-Fi &amp; network','Bluetooth','Music Assistant','Sound &amp; DSP','Picture &amp; meter sync','Phone remote'])assert.ok(cards.includes(label),label);assert.equal((cards.match(/<button/g)||[]).length,6);assert.doesNotMatch(cards,/type="radio"/);
  const shell=render(React.createElement(m.WizardShell,{title:'Sound & DSP setup',steps:['Speakers','Baseline','Ready'],step:1,onClose(){},onNext(){},onSkip(){},onBack(){}},'Content'));
  assert.match(shell,/aria-current="step"/);assert.match(shell,/Baseline/);assert.match(shell,/Back/);assert.match(shell,/Continue/);
  m.setLanguage('nl');
  const dutch=render(React.createElement(m.SetupCards,{snapshot:{},onOpen(){}}));assert.match(dutch,/Wifi en netwerk/);assert.match(dutch,/Klank en DSP/);assert.match(dutch,/Beeld en meters synchroniseren/);
  m.setLanguage('en');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
