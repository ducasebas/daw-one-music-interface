import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {presets} from '../../shared/themes.js';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800}});
const settings=async(page,name)=>{await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('navigation',{name:'Settings categories'}).getByRole('button',{name,exact:true}).click();};
test.beforeEach(async({page})=>{const token=(await(await page.request.get('/api/updates')).json()).controlToken;await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':token},data:{kind:'preferences',confirmed:true}});await page.request.post('/api/scenario',{data:{name:'Playback'}});await page.goto(url);});
test('English default, larger transport and all top-level routes fit the physical screen',async({page})=>{
 for(const name of ['Discover','My music','Search','Queue','Spaces']){
  await page.getByRole('button',{name,exact:true}).click();
  expect(await page.locator('.music2').boundingBox()).toMatchObject({width:1280,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBe(800);
 }
 await page.getByRole('button',{name:'Open Now Playing',exact:true}).click();
 const play=await page.locator('.m2-play').boundingBox();expect(play.width).toBeGreaterThanOrEqual(100);expect(play.height).toBeGreaterThanOrEqual(100);
 const footer=await page.locator('.m2-player').boundingBox();expect(footer.height).toBeGreaterThanOrEqual(160);
 for(const name of ['Previous track','Next track']){const b=await page.getByRole('button',{name,exact:true}).boundingBox();expect(b.width).toBeGreaterThanOrEqual(64);expect(b.height).toBeGreaterThanOrEqual(64);}
 expect(await page.evaluate(()=>getComputedStyle(document.querySelector('.m2-play')).borderTopWidth)).toBe('2px');
 expect(await page.evaluate(()=>getComputedStyle(document.querySelector('.m2-play')).cursor)).toBe('none');
 await expect(page.locator('.m2-brand')).not.toContainText('MUSIC FIRST');
 await page.waitForTimeout(400);await page.screenshot({path:'test-results/touch-now-playing.png'});
});
test('large settings categories, sensor cards and all six skins remain usable',async({page})=>{
 await page.route('**/api/events',r=>r.abort());
 const state=await(await page.request.get('/api/state')).json();state.hardwareTelemetry={enabled:true,temperature:{status:'ok',value:21.5,observedAt:Date.now()},light:{status:'ok',value:485.74,observedAt:Date.now()}};
 await page.route('**/api/state',r=>r.fulfill({json:state}));await page.reload();
 for(const name of ['Playback','Display','Appearance','Audio','Video','Connections','Sensors','Updates','System','Language']){
  await settings(page,name);await expect(page.locator('.settings-detail')).toBeVisible();await expect(page.locator('.m2-player')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBe(800);
 }
 await settings(page,'Sensors');await expect(page.locator('.system-dashboard')).toContainText('21.5 °C');await expect(page.locator('.system-dashboard')).toContainText('486 lux');await page.waitForTimeout(400);await page.screenshot({path:'test-results/touch-sensors.png'});
 await settings(page,'Appearance');
 for(const {id,name} of presets){await page.getByRole('button',{name,exact:true}).click();await expect(page.locator('.music2')).toHaveAttribute('data-theme',id);}
 await page.getByRole('button',{name:'Save',exact:true}).click();await settings(page,'Display');await page.waitForTimeout(400);await page.screenshot({path:'test-results/touch-display-settings.png'});
});
test('language changes immediately, persists and uses the requested Dutch Spaces label',async({page})=>{
 await settings(page,'Language');await page.getByRole('button',{name:'Nederlands',exact:true}).click();await expect(page.getByRole('button',{name:'Ruimtes',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Instellingen',exact:true})).toBeVisible();await page.getByRole('button',{name:'Opslaan',exact:true}).click();
 expect(await page.evaluate(()=>document.documentElement.lang)).toBe('nl');await page.reload();await page.getByRole('button',{name:'Instellingen',exact:true}).click();await page.getByRole('navigation',{name:'Instellingscategorieën'}).getByRole('button',{name:'Taal',exact:true}).click();await page.getByRole('button',{name:'English',exact:true}).click();await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('button',{name:'Spaces',exact:true})).toBeVisible();
});
test('clock fills the rest view; a single touch shows wake feedback and never toggles playback',async({page})=>{
 await settings(page,'Display');await page.getByLabel('Screen rest view').selectOption('widgets');
 const before=await(await page.request.get('/api/state')).json();await page.getByRole('button',{name:'Screen rest',exact:true}).click();
 const sleep=page.getByRole('button',{name:'Wake display',exact:true});await expect(sleep).toBeVisible();expect(parseFloat(await sleep.locator('.sleep-clock').evaluate(e=>getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(220);expect(await sleep.innerText()).not.toContain('SCHERMRUST');
 await page.waitForTimeout(400);await page.screenshot({path:'test-results/touch-screen-rest.png'});
 await page.route('**/api/event',async route=>{if(route.request().postDataJSON()?.type==='activity')await new Promise(r=>setTimeout(r,650));await route.continue();});
 await sleep.tap();await expect(page.getByText('Waking…',{exact:true})).toBeVisible();await expect(sleep).not.toBeVisible();
 const after=await(await page.request.get('/api/state')).json();expect(after.playback.playing).toBe(before.playback.playing);expect(after.device.amplifierEnabled).toBe(before.device.amplifierEnabled);
});
test('timeout saves on the backend and survives reload; all rest modes remain available',async({page})=>{
 await settings(page,'Display');await page.getByLabel('Screen timeout',{exact:true}).selectOption('600');await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('[data-saved="true"]')).toBeVisible();
 expect((await(await page.request.get('/api/display')).json()).settings.timeoutSeconds).toBe(600);
 await page.reload();await settings(page,'Display');await expect(page.getByLabel('Screen timeout',{exact:true})).toHaveValue('600');
 for(const mode of ['clock','widgets','sunset','glow','playing','black']){await page.getByLabel('Screen rest view').selectOption(mode);await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('button',{name:'Screen rest',exact:true}).click();const sleep=page.getByRole('button',{name:'Wake display',exact:true});await expect(sleep).toHaveAttribute('data-mode',mode);if(mode==='black')expect(await sleep.innerText()).toBe('');await sleep.tap();await expect(sleep).not.toBeVisible();}
});
test('a real uploaded video replaces the mock and follows music pause and seek',async({page})=>{
 await page.request.post('/api/event',{data:{type:'pause'}});await page.request.post('/api/event',{data:{type:'seek',position:0}});
 await settings(page,'Video');await page.getByLabel('Choose video',{exact:true}).setInputFiles({name:'example.webm',mimeType:'video/webm',buffer:readFileSync('public/media/startup.webm')});await expect(page.getByRole('status').filter({hasText:'Video linked.'})).toBeVisible();
 await page.getByLabel('Video sync correction',{exact:true}).fill('487');await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('button',{name:'Open Now Playing',exact:true}).click();await page.getByRole('button',{name:'Video Artwork',exact:true}).click();const video=page.getByLabel('Linked music video',{exact:true});await expect(video).toBeVisible();await expect.poll(()=>video.evaluate(v=>v.currentTime)).toBeGreaterThan(.5);expect(await video.evaluate(v=>v.paused)).toBe(true);expect(await video.evaluate(v=>v.muted)).toBe(true);
 await page.request.post('/api/event',{data:{type:'play'}});await expect.poll(()=>video.evaluate(v=>v.paused)).toBe(false);
 await page.waitForTimeout(400);await page.screenshot({path:'test-results/touch-linked-video.png'});
});
test('notifications preserve modal focus and critical faults remain visible over black rest',async({page})=>{
 await page.getByRole('button',{name:'Notifications',exact:true}).click();const tray=page.getByRole('dialog',{name:'Notification panel'});for(const name of ['System report','Update','Hardware alert','Newsletter','What’s new','Tutorial']){await tray.getByRole('button',{name,exact:true}).click();await expect(tray.getByRole('heading',{name,exact:true})).toBeVisible();}
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Notifications',exact:true})).toBeFocused();
 await settings(page,'Display');await page.getByLabel('Screen rest view').selectOption('black');await page.getByRole('button',{name:'Screen rest',exact:true}).click();await page.request.post('/api/event',{data:{type:'thermal-alarm'}});await expect(page.locator('.sleep-fault')).toContainText('thermal-alarm');await page.getByRole('button',{name:'Wake display',exact:true}).tap();await expect(page.locator('.sleep-surface')).not.toBeVisible();const state=await(await page.request.get('/api/state')).json();expect(state.device.amplifierEnabled).toBe(false);expect(state.device.faults).toContain('thermal-alarm');
});
test('startup preference offers a still image and animated WebP replay on the wall display',async({page})=>{
 await settings(page,'Playback');const choice=page.getByRole('combobox',{name:'Startup animation',exact:true});await choice.selectOption('still');await page.getByRole('button',{name:'Replay startup',exact:true}).click();const splash=page.getByRole('status',{name:'Startup animation',exact:true});await expect(splash).toHaveAttribute('data-renderer','still');await expect(splash.locator('video')).toHaveCount(0);await splash.click();await expect(splash).not.toBeVisible();await choice.selectOption('video');await page.getByRole('button',{name:'Replay startup',exact:true}).click();await expect(splash).toHaveAttribute('data-renderer','image-animation');const image=splash.locator('.startup-frame-animation');await expect(image).toHaveJSProperty('naturalWidth',1280);const first=await image.screenshot();await page.waitForTimeout(700);expect((await image.screenshot()).equals(first)).toBe(false);await expect(splash.locator('video')).toHaveCount(0);
});
test('power off requires confirmation, cancels cleanly and the simulator never shuts down its host',async({page})=>{
 const before=await(await page.request.get('/api/state')).json();
 await page.getByRole('button',{name:'Power off TuneBox',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Power off TuneBox',exact:true});await expect(dialog).toContainText('Simulation — no device will be shut down.');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).not.toBeVisible();
 expect((await(await page.request.get('/api/state')).json()).playback.playing).toBe(before.playback.playing);
 await page.getByRole('button',{name:'Power off TuneBox',exact:true}).click();await dialog.getByRole('button',{name:'Power off',exact:true}).click();const off=page.getByRole('status',{name:'Power off in progress',exact:true});await expect(off).toBeVisible();await expect(off).toContainText('Shutting down…');await expect(off).not.toContainText('Shutting down…',{timeout:6000});await expect(page.locator('#root')).toHaveJSProperty('inert',true);expect((await page.request.get('/api/health')).ok()).toBe(true);await page.getByRole('button',{name:'Return to simulation',exact:true}).click();await expect(off).not.toBeVisible();await expect(page.locator('#root')).toHaveJSProperty('inert',false);
});
test('power off remains in the confirmation dialog when the manager rejects shutdown',async({page})=>{
 await page.route('**/api/device',route=>route.request().postDataJSON()?.command==='power-off'?route.fulfill({status:409,json:{error:'Wait for the software update to finish before powering off'}}):route.continue());
 await page.getByRole('button',{name:'Power off TuneBox',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Power off TuneBox',exact:true});await dialog.getByRole('button',{name:'Power off',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('Wait for the software update');await expect(dialog).toBeVisible();await expect(page.locator('.power-off-surface')).toHaveCount(0);
});
