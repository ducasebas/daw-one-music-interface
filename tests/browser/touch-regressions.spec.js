import {chooseSettingsSection} from './settings-helpers.js';
import {test,expect} from '@playwright/test';
import {presets} from '../../shared/themes.js';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800},reducedMotion:'reduce'});
async function token(page){return (await(await page.request.get('/api/updates')).json()).controlToken;}
async function open(page,name){
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 if(name)await chooseSettingsSection(page,name);
}
async function preferences(page,patch){
 const saved=await(await page.request.get('/api/preferences')).json();
 const r=await page.request.post('/api/preferences',{headers:{'X-TuneBox-Control':await token(page)},data:{revision:saved.revision,patch}});
 expect(r.ok()).toBe(true);return (await r.json()).settings;
}
async function unclipped(locator){
 expect(await locator.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
}
const sample={channels:[{rmsDb:-9.03,peakDb:-6.02,clippedSamples:0},{rmsDb:-12,peakDb:-6,clippedSamples:0}],bandsDb:Array.from({length:32},(_,i)=>-18-i),sampleRate:44100,windowFrames:4096,windowMs:92.88,silent:false,capturedAt:Date.now(),sourceUpdatedAt:Date.now(),processingMs:1};
test.beforeEach(async({page})=>{
 await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':await token(page)},data:{kind:'preferences',confirmed:true}});
 const saved=await(await page.request.get('/api/preferences')).json();
 await preferences(page,{prefs:{...saved.prefs,startupAnimation:'off'}});
 await page.request.post('/api/scenario',{data:{name:'Playback'}});await page.goto(url);
});
test('a single checkbox edit enables Save, persists and can be undone',async({page})=>{
 await open(page,'Presence');const save=page.getByRole('button',{name:'Save',exact:true});
 await expect(save).toBeDisabled();await page.getByLabel('Presence detection',{exact:true}).check();await expect(save).toBeEnabled();
 await save.click();await expect(page.locator('[data-saved=true]')).toBeVisible();
 const status=page.locator('[data-saved=true]');await unclipped(status);await expect(status.locator('svg')).toBeInViewport();
 await page.screenshot({path:'test-results/touch-saved.png'});await expect(save).toBeDisabled();
 expect((await(await page.request.get('/api/preferences')).json()).presence.enabled).toBe(true);
 await page.getByLabel('Presence detection',{exact:true}).uncheck();await expect(save).toBeEnabled();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByLabel('Presence detection',{exact:true})).toBeChecked();await expect(save).toBeDisabled();
 for(const name of ['Presence detection','Night schedule']){
  const checkbox=page.getByLabel(name,{exact:true});await checkbox.setChecked(!await checkbox.isChecked());await expect(save).toBeEnabled();
  await checkbox.setChecked(!await checkbox.isChecked());await expect(save).toBeDisabled();
 }
 await chooseSettingsSection(page,'Display');
 for(const name of ['Show date','Show wake hint']){
  const checkbox=page.getByLabel(name,{exact:true});await checkbox.setChecked(!await checkbox.isChecked());await expect(save).toBeEnabled();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(save).toBeDisabled();
 }
});
test('all settings tiles and each topic fit all six skins, including the fixed save and player bars',async({page})=>{
 test.setTimeout(180000);
 for(const skin of presets){
  const old=await(await page.request.get('/api/preferences')).json();
  await preferences(page,{themePreferences:{...old.themePreferences,selected:skin.id,mode:'manual'}});await page.reload();
  await open(page);const nav=page.getByRole('navigation',{name:'Settings categories'});await expect(nav.getByRole('button')).toHaveCount(5);
  for(const tile of await nav.getByRole('button').all()){
   await expect(tile).toBeInViewport();await unclipped(tile);expect(await tile.evaluate(e=>e.scrollHeight<=e.clientHeight+1),`${skin.id}: ${await tile.innerText()}`).toBe(true);
   const box=await tile.boundingBox();expect(box.height).toBeGreaterThanOrEqual(90);
  }
  await page.screenshot({path:`test-results/overview-${skin.id}.png`});
  for(const name of ['Playback','Display','Appearance','Audio','Video','Connections','Sensors','Presence','Date & time','Security','Updates','System','Language','Developer','Room measurement']){
   await chooseSettingsSection(page,name);
   await expect(page.locator('.hub-body')).toBeVisible();await unclipped(page.locator('.hub-body'));
   // Section navigation and async panels can still update layout on the next frame.
   // Check the reachable bottom after a frame instead of racing the focus scroll.
   await expect.poll(()=>page.locator('.hub-body').evaluate(async e=>{
    e.scrollTo({top:e.scrollHeight,behavior:'instant'});
    await new Promise(resolve=>requestAnimationFrame(resolve));
    return e.scrollTop+e.clientHeight>=e.scrollHeight-2;
   }),{message:`${skin.id}: ${name} must scroll to its final content`}).toBe(true);
   await expect(page.locator('.hub-savebar')).toBeInViewport();await expect(page.getByRole('button',{name:'Save',exact:true})).toBeInViewport();
   await expect(page.locator('.m2-player')).toBeInViewport();await expect(page.getByRole('button',{name:'Open Now Playing',exact:true})).toBeEnabled();
   expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBe(800);
  }
 }
});
test('All settings leads to Now Playing, and the footer always returns without losing unsaved work',async({page})=>{
 await open(page,'Presence');await page.getByLabel('Presence detection',{exact:true}).check();
 await page.getByRole('button',{name:'Open Now Playing',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Unsaved changes'});
 await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Stay here'}).click();
 await expect(page.locator('.music2')).toHaveAttribute('data-page','settings');
 await page.getByRole('button',{name:'All settings',exact:true}).click();await dialog.getByRole('button',{name:'Save and continue'}).click();
 await expect(page.locator('.settings-overview')).toBeVisible();await page.locator('.hub-back').click();
 await expect(page.locator('.music2')).toHaveAttribute('data-page','playing');await expect(page.getByRole('button',{name:'Open Now Playing',exact:true})).toBeDisabled();
 for(const name of ['Discover','My music','Search','Queue','Rooms']){
  await page.getByRole('button',{name,exact:true}).click();if(name==='Search')await page.getByRole('button',{name:'Done typing',exact:true}).click();await page.getByRole('button',{name:'Open Now Playing',exact:true}).click();await expect(page.locator('.music2')).toHaveAttribute('data-page','playing');
 }
 await open(page,'Presence');await page.getByLabel('Night schedule',{exact:true}).check();await page.getByRole('button',{name:'Open Now Playing',exact:true}).click();
 await dialog.getByRole('button',{name:'Discard changes',exact:true}).click();await expect(page.locator('.music2')).toHaveAttribute('data-page','playing');
 expect((await(await page.request.get('/api/preferences')).json()).presence.nightEnabled).toBe(false);
});
test('tap and double tap never select kiosk text; inputs and scrolling still work',async({page})=>{
 await page.locator('.m2-playing h2').dblclick();expect(await page.evaluate(()=>getSelection().toString())).toBe('');
 await open(page,'Presence');const input=page.getByLabel('Maximum distance (m)',{exact:true});await input.fill('4');await expect(input).toHaveValue('4');await expect(page.getByRole('button',{name:'Save',exact:true})).toBeEnabled();
 expect(await input.evaluate(e=>getComputedStyle(e).userSelect)).toBe('none');
 await page.locator('.hub-body').evaluate(e=>e.scrollTo(0,e.scrollHeight));expect(await page.locator('.hub-body').evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
 await page.locator('.hub-heading h2').dblclick();expect(await page.evaluate(()=>getSelection().toString())).toBe('');
});
test('volume dial and real PCM preview are large; a saved cap changes the control range without changing playback',async({page})=>{
 await page.route('**/api/audio?watch=1',r=>r.fulfill({json:{configured:true,enabled:true,status:'pcm',source:'squeezelite-pcm',simulated:false,measurement:sample}}));
 await open(page,'Playback');const current=(await(await page.request.get('/api/state')).json()).audio.volume;
 await page.getByLabel('Volume control',{exact:true}).selectOption('circular');await page.getByLabel('Maximum volume',{exact:true}).fill('65');
 await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('[data-saved=true]')).toBeVisible();
 const dial=page.getByRole('slider',{name:'Volume',exact:true});await expect(dial).toHaveAttribute('aria-valuemax','65');expect((await dial.boundingBox()).width).toBeGreaterThanOrEqual(112);expect((await dial.locator('svg').boundingBox()).width).toBeGreaterThanOrEqual(112);
 expect((await(await page.request.get('/api/state')).json()).audio.volume).toBe(current);
 await chooseSettingsSection(page,'Audio');
 await expect(page.locator('.hub-audio .audio-spectrum')).toBeVisible();expect((await page.locator('.hub-audio .audio-spectrum').boundingBox()).height).toBeGreaterThanOrEqual(240);
 await page.getByLabel('Visualizer',{exact:true}).selectOption('spectrum');await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('[data-saved=true]')).toBeVisible();
 await page.getByRole('button',{name:'Open Now Playing',exact:true}).click();await expect(page.locator('.m2-playing .audio-spectrum')).toBeVisible();expect((await page.locator('.m2-playing .audio-spectrum').boundingBox()).width).toBeGreaterThan(650);await page.screenshot({path:'test-results/touch-pcm-large.png'});
 await dial.focus();await page.keyboard.press('End');await expect.poll(async()=>(await(await page.request.get('/api/state')).json()).audio.volume).toBe(65);
});
test('Wi-Fi header uses measured fan bars, with percentages only in details',async({page})=>{
 for(const [signal,bars] of [[80,3],[50,2],[15,1],[0,0]]){
  await page.route('**/api/network',r=>r.fulfill({json:{connected:true,signal,simulated:false}}));await page.reload();
  await expect(page.locator('.wifi-signal')).toHaveAttribute('data-bars',String(bars));
  expect(await page.locator('.network-label').evaluate(e=>getComputedStyle(e).clipPath)).toBe('inset(50%)');
  await page.locator('.m2-network summary').click();await expect(page.locator('.m2-network-info')).toContainText(`${signal}%`);
  await page.unroute('**/api/network');
 }
 await page.route('**/api/network',r=>r.fulfill({json:{connected:null,signal:null}}));await page.reload();await expect(page.locator('.wifi-signal')).toHaveCount(0);
});
test('explicit WebP animation plays even with reduced motion and records honest diagnostics',async({page})=>{
 await open(page,'Playback');await page.getByLabel('Startup animation',{exact:true}).selectOption('still');await page.getByRole('button',{name:'Replay startup',exact:true}).click();const splash=page.getByRole('status',{name:'Startup animation',exact:true});await expect(splash).toHaveAttribute('data-renderer','still');await splash.click();
 await page.getByLabel('Startup animation',{exact:true}).selectOption('video');await page.getByRole('button',{name:'Replay startup',exact:true}).click();
 await expect(splash).toHaveAttribute('data-renderer','image-animation');
 const image=splash.locator('.startup-frame-animation');await expect(image).toHaveJSProperty('naturalWidth',1280);
 const first=await image.screenshot();await page.waitForTimeout(900);expect((await image.screenshot()).equals(first)).toBe(false);
 const source='/media/startup.webp';
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tunebox-startup-status')).time)).toBeGreaterThan(.4);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('tunebox-startup-status')).frames)).toBeNull();
 await splash.click();await page.getByText('Splash diagnostics',{exact:true}).click();await expect(page.locator('.startup-diagnostics')).toContainText(source);
});
test('manual moon wake stays available in live read-only mode with Music Assistant disconnected',async({page})=>{
 const live=s=>({...s,mode:'music-assistant',musicAssistant:{connected:false,controlEnabled:false,volumeLimit:40}});
 await page.route('**/api/events',r=>r.abort());
 await page.route('**/api/state',async r=>{const response=await r.fetch();await r.fulfill({json:live(await response.json())});});
 await page.route('**/api/event',async r=>{const response=await r.fetch();await r.fulfill({status:response.status(),json:live(await response.json())});});
 await page.reload();const before=await(await page.request.get('/api/state')).json();
 await page.getByRole('button',{name:'Screen rest',exact:true}).tap();const wake=page.getByRole('button',{name:'Wake display',exact:true});await expect(wake).toBeVisible();await wake.tap();await expect(wake).not.toBeVisible();
 const after=await(await page.request.get('/api/state')).json();expect(after.playback.playing).toBe(before.playback.playing);expect(after.device.amplifierEnabled).toBe(before.device.amplifierEnabled);await expect(page.locator('.m2-player-status')).not.toContainText('Simulation controls are disabled');
});
test('explicit animation overrides Pi3 automatic still policy and missing WebP plus MP4 retries WebM',async({page})=>{
 await page.goto(url+'&profile=pi3');await open(page,'Playback');await page.getByLabel('Startup animation',{exact:true}).selectOption('video');
 await page.route('**/media/startup.webp*',r=>r.abort());await page.route('**/media/startup.mp4',r=>r.abort());await page.getByRole('button',{name:'Replay startup',exact:true}).click();
 const splash=page.getByRole('status',{name:'Startup animation',exact:true});await expect(splash).toHaveAttribute('data-renderer','video');await expect(splash.locator('video')).toHaveAttribute('src','/media/startup.webm');await expect.poll(()=>splash.locator('video').evaluate(v=>v.currentTime)).toBeGreaterThan(.3);
});
