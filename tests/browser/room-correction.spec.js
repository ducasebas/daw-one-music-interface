import {chooseSettingsSection} from './settings-helpers.js';
import {test,expect} from '@playwright/test';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
const shot=async(page,name)=>{if(process.env.TUNEBOX_SHOTS)await page.screenshot({path:process.env.TUNEBOX_SHOTS+'/'+name+'.png'});};
test.use({viewport:{width:1280,height:800}});

const bands=[];for(let f=31.5;f<=16000;f*=2**(1/6))bands.push(Math.round(f*10)/10);
// A room with a bass peak around 80–120 Hz, as a measured relative response.
const channel=(name,peak)=>({channel:name,valid:true,sweepDetected:true,snrDb:32,neededDb:0,clipPercent:0,warnings:[],points:bands.map(hz=>({hz,db:hz>=70&&hz<=130?peak:0}))});
const baseline={baseline:'flat-eq',levelDbfs:-36,channels:[channel('left',8),channel('right',7)],profile:{}};
const check={baseline:'current-dsp',levelDbfs:-36,channels:[channel('left',2),channel('right',1.5)],baselineChannels:baseline.channels,profile:{}};

/** Fake measurement hardware; profile saving and every other command use the real simulator. */
async function fakeHardware(page){
 const sent=[];let state={supported:true,running:false,microphones:[{id:'hw:2,0',name:'UMIK-1'}],phase:'idle',output:'plughw:CARD=LouderRaspberry,DEV=0'};
 await page.route('**/api/device',async route=>{
  const body=route.request().postDataJSON();if(!String(body?.command).startsWith('measurement-'))return route.continue();
  sent.push(body);
  if(body.command==='measurement-status')return route.fulfill({json:state});
  if(body.command==='measurement-start'){state={...state,running:true,phase:'measuring-left',percent:5,remainingSeconds:20};return route.fulfill({json:{queued:true,stopped:['playback']}});}
  if(body.command==='measurement-apply'||body.command==='measurement-undo')return route.fulfill({json:{applied:true}});
  if(body.command==='measurement-stop'){state={...state,running:false,phase:'cancelled'};return route.fulfill({json:{stopped:true}});}
  return route.fulfill({status:409,json:{error:'unexpected'}});
 });
 return {sent,set:next=>{state={...state,...next};},starts:()=>sent.filter(r=>r.command==='measurement-start')};
}
test.beforeEach(async({page})=>{const token=(await(await page.request.get('/api/updates')).json()).controlToken;await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':token},data:{kind:'preferences',confirmed:true}});});

test('room correction wizard walks room → speakers → microphone → target → measure → correct → check, with audio only after confirmation',async({page})=>{
 const hw=await fakeHardware(page);
 await page.goto(url);await chooseSettingsSection(page,'Room measurement',{open:true});
 await page.locator('details.rc-advanced').evaluate(d=>{d.open=false;});await shot(page,'0-settings');
 await page.getByRole('button',{name:/^Room correction/}).click();
 const wizard=page.getByRole('dialog',{name:'Room correction'}),next=name=>wizard.getByRole('button',{name,exact:true});
 await expect(wizard.getByRole('heading',{name:'Your room'})).toBeVisible();
 // Touch steppers, no keyboard: 5.0 m → 5.5 m.
 await wizard.getByRole('button',{name:'More · Length'}).click();await shot(page,'1-room');await expect(wizard.getByRole('group',{name:'Length'}).locator('output')).toHaveText('5.5 m');
 await next('Continue').click();
 await wizard.getByRole('button',{name:'Against a wall',exact:true}).click();await shot(page,'2-speakers');await next('Continue').click();
 await expect(wizard.getByText('✓ UMIK-1 found')).toBeVisible();await shot(page,'3-microphone');await next('Continue').click();
 await wizard.getByRole('button',{name:/^Neutral/}).click();await shot(page,'4-target');await next('Save and continue to the measurement').click();
 const saved=await(await page.request.get('/api/measurement/profile')).json();expect(saved.length).toBe(5.5);expect(saved.placement).toBe('wall');expect(saved.target.preset).toBe('neutral');
 // Measurement 1 of 2: nothing plays until the sweep is confirmed.
 await expect(wizard.getByRole('heading',{name:'Measurement 1 of 2: your room as it is'})).toBeVisible();
 await expect(next('Continue to the correction')).toBeDisabled();expect(hw.starts()).toHaveLength(0);await shot(page,'5-measure');
 await wizard.getByRole('button',{name:'Start measurement sweep…'}).click();
 const confirm=page.getByRole('dialog',{name:'Start audible measurement'});await expect(confirm.getByRole('button',{name:'Play the sweep'})).toBeDisabled();await shot(page,'6-confirm');
 await confirm.getByRole('button',{name:'Cancel'}).click();expect(hw.starts()).toHaveLength(0);
 await wizard.getByRole('button',{name:'Start measurement sweep…'}).click();await confirm.getByRole('checkbox').check();await confirm.getByRole('button',{name:'Play the sweep'}).click();
 await expect.poll(()=>hw.starts().length).toBe(1);expect(hw.starts()[0].args).toMatchObject({verifyCorrection:false,confirmed:true,microphone:'hw:2,0',levelDbfs:-36});
 await expect(wizard.getByRole('button',{name:'Stop measurement'})).toBeVisible();await shot(page,'7-running');
 hw.set({running:false,phase:'complete',percent:100,result:baseline});
 await expect(wizard.getByText('✓ Both speakers measured. Continue to see the proposed correction.')).toBeVisible();
 await shot(page,'8-measured');await next('Continue to the correction').click();
 // Correction: a DSP change, confirmed separately; no sweep.
 await expect(wizard.getByRole('heading',{name:'The proposed correction'})).toBeVisible();await shot(page,'9-correct');await expect(next('Continue to the check')).toBeDisabled();
 await wizard.getByRole('button',{name:'Apply correction…'}).click();const apply=page.getByRole('dialog',{name:'Apply listening target'});await apply.getByRole('checkbox').check();await apply.getByRole('button',{name:'Confirm DSP change'}).click();
 await expect.poll(()=>hw.sent.find(r=>r.command==='measurement-apply')?.args?.target?.preset).toBe('neutral');expect(hw.starts()).toHaveLength(1);
 await next('Continue to the check').click();
 // Measurement 2 of 2: verification keeps the correction on.
 await expect(wizard.getByRole('heading',{name:'Measurement 2 of 2: check the result'})).toBeVisible();
 await wizard.getByRole('button',{name:'Start check sweep…'}).click();await confirm.getByRole('checkbox').check();await confirm.getByRole('button',{name:'Play the sweep'}).click();
 await expect.poll(()=>hw.starts().length).toBe(2);expect(hw.starts()[1].args.verifyCorrection).toBe(true);
 hw.set({running:false,phase:'complete',percent:100,result:check});
 await expect(wizard.getByText(/Distance to your target: .* dB before, .* dB now\./)).toBeVisible();await expect(wizard.getByText('The correction brings the sound closer to your target.')).toBeVisible();
 await shot(page,'10-check');
 await next('Finish').click();await expect(wizard.getByRole('heading',{name:'Room correction is on'})).toBeVisible();await shot(page,'11-ready');
 await next('Done').click();await expect(wizard).toHaveCount(0);
});

test('the wizard waits for a microphone, offers a louder retry for a quiet sweep and blocks leaving during a sweep',async({page})=>{
 const hw=await fakeHardware(page);hw.set({microphones:[]});
 await page.goto(url);await chooseSettingsSection(page,'Room measurement',{open:true});await page.getByRole('button',{name:/^Room correction/}).click();
 const wizard=page.getByRole('dialog',{name:'Room correction'});
 for(let i=0;i<2;i++)await wizard.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(wizard.getByText('Plug the USB microphone into TuneBox. It is detected automatically.')).toBeVisible();await expect(wizard.getByRole('button',{name:'Continue',exact:true})).toBeDisabled();
 hw.set({microphones:[{id:'hw:3,0',name:'UMIK-2'}]});await expect(wizard.getByText('✓ UMIK-2 found')).toBeVisible({timeout:8000});
 await wizard.getByRole('button',{name:'Continue',exact:true}).click();await wizard.getByRole('button',{name:'Save and continue to the measurement'}).click();
 await wizard.getByRole('button',{name:'Start measurement sweep…'}).click();const confirm=page.getByRole('dialog',{name:'Start audible measurement'});await confirm.getByRole('checkbox').check();await confirm.getByRole('button',{name:'Play the sweep'}).click();
 await expect(wizard.getByRole('button',{name:'Stop measurement'})).toBeVisible();
 await wizard.getByRole('button',{name:'Finish later'}).click();await expect(wizard.getByText('Stop the sweep before leaving the wizard.')).toBeVisible();await expect(wizard).toBeVisible();
 const quiet={...baseline,channels:baseline.channels.map(c=>({...c,valid:false,snrDb:9,neededDb:6}))};hw.set({running:false,phase:'complete',result:quiet});
 await expect(wizard.getByText('6 dB short of the 15 dB needed.').first()).toBeVisible();await expect(wizard.getByRole('button',{name:'Continue to the correction'})).toBeDisabled();
 await wizard.getByRole('button',{name:'Measure again 6 dB louder (-30 dBFS)…'}).click();await expect(confirm.getByText('Sweep level: -30 dBFS')).toBeVisible();
 await confirm.getByRole('checkbox').check();await confirm.getByRole('button',{name:'Play the sweep'}).click();await expect.poll(()=>hw.starts().at(-1)?.args.levelDbfs).toBe(-30);
});
