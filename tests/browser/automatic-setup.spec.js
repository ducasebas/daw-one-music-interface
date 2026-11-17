import {test,expect} from '@playwright/test';
import {chooseSettingsSection} from './settings-helpers.js';

const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
const id='12345678-1234-1234-1234-123456789abc',contextKey='a'.repeat(64);
test.use({viewport:{width:1280,height:800},reducedMotion:'reduce'});
async function auth(page){return {'X-TuneBox-Control':(await(await page.request.get('/api/updates')).json()).controlToken};}
async function open(page,button){
 await page.goto(url);await page.getByRole('button',{name:'Settings',exact:true}).click();
 await chooseSettingsSection(page,'Audio');
 await page.getByRole('button',{name:button,exact:true}).click();
}
async function visibleControls(dialog){
 const bounds=await dialog.boundingBox();
 for(const button of await dialog.locator(':scope > header button,:scope > footer button').all()){
  const b=await button.boundingBox();expect(b.height).toBeGreaterThanOrEqual(44);expect(b.y).toBeGreaterThanOrEqual(bounds.y);expect(b.y+b.height).toBeLessThanOrEqual(bounds.y+bounds.height+1);
  expect(await button.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===el||el.contains(hit);})).toBe(true);
 }
}
test.beforeEach(async({page})=>{
 const headers=await auth(page);await page.request.post('/api/reset',{headers,data:{kind:'preferences',confirmed:true}});
 const p=await(await page.request.get('/api/preferences')).json();await page.request.post('/api/preferences',{headers,data:{revision:p.revision,patch:{setupCompleted:true,prefs:{...p.prefs,startupAnimation:'off'}}}});
 await page.request.post('/api/scenario',{data:{name:'Playback'}});
});
test.afterEach(async({page})=>{await page.unrouteAll({behavior:'wait'});await page.request.post('/api/reset',{headers:await auth(page),data:{kind:'preferences',confirmed:true}});});

test('unsupported hardware permits leaving optional sound setup and never claims a DSP application',async({page})=>{
 await open(page,'Open sound setup');const wizard=page.getByRole('dialog',{name:'Sound & DSP setup',exact:true});
 await visibleControls(wizard);await wizard.getByRole('button',{name:'Continue',exact:true}).click();await wizard.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(wizard.getByRole('button',{name:'Apply sound settings',exact:true})).toBeDisabled();await expect(wizard).toContainText('real Louder equalizer');
 await wizard.getByRole('button',{name:'Skip for now',exact:true}).click();await expect(wizard).not.toBeVisible();await expect(page.locator('[data-section="audio"]')).toBeVisible();
});

test('missing microphone leaves automatic synchronization optional at both display sizes',async({page})=>{
 await open(page,'Open synchronization wizard');const wizard=page.getByRole('dialog',{name:'Picture & meter sync',exact:true});
 await visibleControls(wizard);await page.setViewportSize({width:1280,height:400});await visibleControls(wizard);
 await wizard.getByRole('button',{name:'Continue',exact:true}).click();await expect(wizard).toContainText('No USB microphone detected');await expect(wizard.getByRole('button',{name:'Start automatic measurement',exact:true})).toBeDisabled();
 await wizard.getByRole('button',{name:'Finish later',exact:true}).click();await expect(wizard).not.toBeVisible();
});

test('capture requires consent, shows progress, saves the measured profile once and keeps its own fine adjustment',async({page})=>{
 let phase='ready';const commands=[],saves=[];
 const result={valid:true,id,contextKey,method:'pcm-microphone-energy',delayMs:200,uncertaintyMs:50,correlation:.9,timing:{screenDelayMs:280,visualizerTrimMs:-80}};
 await page.route('**/api/device',async route=>{
  const body=route.request().postDataJSON();commands.push(body.command);
  if(body.command==='sync-status'){const running=phase==='measuring';return route.fulfill({json:{supported:true,microphones:[{id:'hw:3,0',name:'USB measurement microphone'}],running,phase,percent:running?40:100,...(phase==='complete'?{result}:{})}});}
  if(body.command==='sync-start'){phase='measuring';return route.fulfill({json:{queued:true,id}});}return route.continue();
 });
 await page.route('**/api/audio',route=>route.fulfill({json:{configured:true,enabled:true,status:'pcm'}}));
 await page.route('**/api/sync/clock',route=>route.fulfill({json:{now:performance.now(),capturedAt:performance.now()-40,windowMs:85.33}}));
 await page.route('**/api/sync/profiles',route=>{saves.push(route.request().postDataJSON());return route.fulfill({json:{saved:true,profile:result}});});
 await open(page,'Open synchronization wizard');const wizard=page.getByRole('dialog',{name:'Picture & meter sync',exact:true});await wizard.getByRole('button',{name:'Continue',exact:true}).click();
 await wizard.getByRole('button',{name:'USB measurement microphone',exact:true}).click();const start=wizard.getByRole('button',{name:'Start automatic measurement',exact:true});await expect(start).toBeDisabled();
 await wizard.getByLabel('Allow 12 seconds of microphone energy measurement. Raw microphone audio is not retained.',{exact:true}).check();await start.click();await expect(wizard.getByRole('heading',{name:'Measuring synchronization…',exact:true})).toBeVisible();expect(saves).toHaveLength(0);
 phase='complete';await expect(wizard.getByRole('heading',{name:'Measured synchronization',exact:true})).toBeVisible();const fine=wizard.getByLabel('Fine adjustment for this output',{exact:true});await fine.focus();for(let i=0;i<5;i++)await fine.press('ArrowRight');await expect(fine).toHaveValue('25');
 await wizard.getByRole('button',{name:'Use measured timing',exact:true}).click();await expect(wizard.getByRole('button',{name:'Done',exact:true})).toBeVisible();expect(saves).toEqual([{resultId:id,confirmed:true,useVideo:false,fineMs:25}]);
 for(const command of ['measurement-start','dsp-set','bluetooth-start','save-music','install'])expect(commands).not.toContain(command);
});

test('a rejected timing capture cannot be saved and this wizard cannot cancel another capture',async({page})=>{
 let running=true,stops=0;
 await page.route('**/api/device',route=>{
  const {command}=route.request().postDataJSON();if(command==='sync-status')return route.fulfill({json:{supported:true,running,microphones:[],phase:'failed',error:'The timing match is ambiguous. Use a track with distinct, irregular transients'}});
  if(command==='sync-stop'){stops++;running=false;return route.fulfill({json:{stopped:true}});}return route.continue();
 });
 await open(page,'Open synchronization wizard');const wizard=page.getByRole('dialog',{name:'Picture & meter sync',exact:true});await wizard.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(wizard.getByRole('alert')).toContainText('ambiguous');await expect(wizard.getByRole('button',{name:'Use measured timing',exact:true})).toHaveCount(0);
 // A separate capture is reported, so this wizard must not cancel someone else's work.
 await wizard.getByRole('button',{name:'Finish later',exact:true}).click();expect(stops).toBe(0);
});
