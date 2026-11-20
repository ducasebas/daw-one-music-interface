import {chooseSettingsSection} from './settings-helpers.js';
import {test,expect} from '@playwright/test';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800}});

/** Fake measurement hardware in the browser; every other device command is real (simulated). */
async function fakeMeasurement(page,{microphones=[{id:'hw:2,0',name:'UMIK-1'}]}={}){
 const sent=[];let state={supported:true,running:false,microphones,phase:'idle',output:'plughw:CARD=LouderRaspberry,DEV=0'};
 const api={sent,set:next=>{state={...state,...next};}};
 await page.route('**/api/device',async route=>{
  const body=route.request().postDataJSON();
  if(!String(body?.command).startsWith('measurement-'))return route.continue();
  sent.push(body);
  if(body.command==='measurement-status')return route.fulfill({json:state});
  if(body.command==='measurement-start'){state={...state,running:true,phase:'measuring-left',percent:5,remainingSeconds:14};return route.fulfill({json:{queued:true,stopped:['group','playback']}});}
  if(body.command==='measurement-stop'){state={...state,running:false,phase:'cancelled',percent:0,remainingSeconds:undefined};return route.fulfill({json:{stopped:true}});}
  return route.fulfill({status:409,json:{error:'unexpected'}});
 });
 return api;
}
async function openMeasure(page){
 await page.goto(url);await page.locator('.m2-header').getByRole('button',{name:'Settings',exact:true}).click();await chooseSettingsSection(page,'Room measurement');
 await page.getByRole('navigation',{name:'Measurement topics'}).getByRole('button',{name:'Measure',exact:true}).click();
}
test.beforeEach(async({page})=>{const token=(await(await page.request.get('/api/updates')).json()).controlToken;await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':token},data:{kind:'preferences',confirmed:true}});});

test('a single detected microphone is chosen automatically and a missing one explains the grey button',async({page})=>{
 const fake=await fakeMeasurement(page,{microphones:[]});
 await openMeasure(page);
 const start=page.getByRole('button',{name:'Start audible sweep…',exact:true});
 await expect(start).toBeDisabled();
 await expect(page.getByText('No USB microphone detected. Connect it and tap Scan microphones.')).toBeVisible();
 fake.set({microphones:[{id:'hw:2,0',name:'UMIK-1'}]});
 await page.getByRole('button',{name:'Scan microphones',exact:true}).click();
 await expect(page.getByLabel('USB microphone',{exact:true})).toHaveValue('hw:2,0');
 await expect(start).toBeEnabled();
 await expect(page.locator('.measurement-blocked')).toHaveCount(0);
});

test('confirming the sweep stops other audio first, then shows remaining time and a large stop button',async({page})=>{
 const fake=await fakeMeasurement(page);
 await openMeasure(page);
 await page.getByRole('button',{name:'Start audible sweep…',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Start audible measurement'});
 await expect(dialog.getByText('Other rooms keep playing.',{exact:false})).toBeVisible();
 await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Confirm audible measurement',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Measuring the left speaker'})).toBeVisible();
 await expect(page.getByText(/^About \d+ seconds remaining$/)).toBeVisible();
 await expect(page.getByText('Before the sweep: left the group, music paused')).toBeVisible();
 const start=fake.sent.find(r=>r.command==='measurement-start');
 expect(start.args).toMatchObject({microphone:'hw:2,0',confirmed:true,stopOthers:true});
 const stop=page.getByRole('button',{name:'Stop measurement',exact:true}),box=await stop.boundingBox();
 expect(box.height).toBeGreaterThanOrEqual(88);expect(box.width).toBeGreaterThan(600);
 await expect(stop).toBeEnabled();await expect(stop).toBeInViewport({ratio:1});await expect(page.getByRole('heading',{name:'Measuring the left speaker'})).toBeInViewport({ratio:1});
 await stop.click();
 await expect(page.getByText('Measurement stopped. No correction was applied.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Start audible sweep…',exact:true})).toBeEnabled();
});

test('a finished sweep opens Results by itself, and a completed status offers an Open results button',async({page})=>{
 const fake=await fakeMeasurement(page);
 await openMeasure(page);
 await page.getByRole('button',{name:'Start audible sweep…',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Start audible measurement'});await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Confirm audible measurement',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Measuring the left speaker'})).toBeVisible();
 fake.set({running:false,phase:'complete',percent:100,remainingSeconds:undefined});
 const topics=page.getByRole('navigation',{name:'Measurement topics'});
 await expect(topics.getByRole('button',{name:'Results',exact:true})).toHaveAttribute('aria-pressed','true');
 await topics.getByRole('button',{name:'Measure',exact:true}).click();
 await page.getByRole('button',{name:'Open results',exact:true}).click();
 await expect(topics.getByRole('button',{name:'Results',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('a quiet result explains the missing dB and offers one 6 dB louder retry with consent',async({page})=>{
 const fake=await fakeMeasurement(page);
 const channel=(name,snr,needed)=>({channel:name,valid:needed===0,snrDb:snr,neededDb:needed,clipPercent:0,sweepDetected:true,warnings:needed?['Measurement signal is too close to the noise floor.']:[],points:[{hz:100,db:0},{hz:1000,db:0}]});
 fake.set({phase:'complete',result:{baseline:'flat-eq',levelDbfs:-36,channels:[channel('left',12.4,3),channel('right',9.6,6)],profile:{}}});
 await openMeasure(page);
 await page.getByRole('navigation',{name:'Measurement topics'}).getByRole('button',{name:'Results',exact:true}).click();
 await expect(page.getByText('6 dB short of the 15 dB needed.')).toBeVisible();
 await page.getByRole('button',{name:'Measure again 6 dB louder (-30 dBFS)…'}).click();
 const dialog=page.getByRole('dialog',{name:'Start audible measurement'});await expect(dialog.getByText('Sweep level: -30 dBFS')).toBeVisible();
 await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Confirm audible measurement',exact:true}).click();
 await expect.poll(()=>fake.sent.find(r=>r.command==='measurement-start')?.args.levelDbfs).toBe(-30);
});

test('a sweep that was not detected explains which check failed, with technical details and an older-analyser notice',async({page})=>{
 const {sweep,analyse,rate}=await import('../../deploy/measurement/signal.mjs');
 // Real analyser output: the sweep arrived 1.4 s late in a 5 s recording and ran past its end.
 const input=sweep(-30),late=Math.round(rate*1.4),recording=new Float32Array(rate*5);recording.set(input.subarray(0,recording.length-late),late);
 const left={...analyse(input,recording),channel:'left'};left.diagnostics.timing={playerStartMs:180,captureMs:5200};
 // A result written by the 3.9.x analyser on the Pi has no diagnostics at all.
 const right={channel:'right',valid:false,snrDb:31,neededDb:0,clipPercent:0,sweepDetected:false,correlation:.04,warnings:[],points:[{hz:100,db:0}]};
 const fake=await fakeMeasurement(page);fake.set({phase:'complete',result:{baseline:'flat-eq',levelDbfs:-30,channels:[left,right],profile:{}}});
 await openMeasure(page);
 await page.getByRole('navigation',{name:'Measurement topics'}).getByRole('button',{name:'Results',exact:true}).click();
 const l=page.locator('.measurement-diagnosis[data-channel="left"]'),r=page.locator('.measurement-diagnosis[data-channel="right"]');
 await expect(l.getByText('The sweep arrived 1400 ms late and ran past the end of the recording.')).toBeVisible();
 await expect(r.getByText(/older measurement software on the device/)).toBeVisible();
 await l.getByText('Technical details').click();
 await expect(l.getByText(/✗ complete/)).toBeVisible();await expect(l.getByText(/✓ prominence/)).toBeVisible();
 await expect(l.getByText(/Player started after the microphone: 180 ms/)).toBeVisible();
 await page.screenshot({path:'docs/images/sweep-diagnostics/results-diagnosis.png'});
});
