import {test,expect,devices} from '@playwright/test';
import {chooseSettingsSection} from './settings-helpers.js';
import {remoteView} from '../../server/remote-control.js';
import {holdToWake} from './wake-helper.js';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800}});
async function configure(page,patch={}){
 const token=(await(await page.request.get('/api/updates')).json()).controlToken;
 await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':token},data:{kind:'preferences',confirmed:true}});
 const p=await(await page.request.get('/api/preferences')).json();
 await page.request.post('/api/preferences',{headers:{'X-TuneBox-Control':token},data:{revision:p.revision,patch:{setupCompleted:true,prefs:{...p.prefs,startupAnimation:'off',headerAutoHide:false,...patch}}}});
 return token;
}
test('floating widgets, larger track text and default clock fit the wall without touching the footer',async({page})=>{
 await configure(page,{widgets:['clock','upnext','source','power']});await page.goto(url);
 await expect(page.locator('.header-clock')).toBeVisible();expect(await page.getByRole('slider',{name:'Playback position',exact:true}).evaluate(n=>getComputedStyle(n).appearance)).toBe('none');await expect(page.locator('.np-widget')).toHaveCount(4);
 await expect(page.locator('.np-widget small')).toHaveCount(0);await expect(page.locator('.track-title')).toHaveAccessibleName('Weightless');
 for(const cls of ['.np-widgets','.m2-track','.m2-header']){const b=await page.locator(cls).boundingBox();expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(1281);}
 const footer=await page.locator('.m2-player').boundingBox(),widgets=await page.locator('.np-widgets').boundingBox();expect(widgets.y+widgets.height).toBeLessThanOrEqual(footer.y+1);
 expect(await page.locator('.np-widget').first().evaluate(n=>getComputedStyle(n).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
 await expect(page.getByRole('button',{name:'Switch visualizer',exact:true})).toContainText('Turn on visualizer');
 await page.screenshot({path:'test-results/flow-now-playing.png'});
});
test('display choices save and restore without resetting speaker gain or playback volume',async({page})=>{
 await configure(page);await page.goto(url);await chooseSettingsSection(page,'Display',{open:true});
 await page.getByRole('combobox',{name:'Graphics',exact:true}).selectOption('smooth');
 await page.getByLabel('Clock in the header',{exact:true}).uncheck();
 await page.getByRole('slider',{name:'Visualizer sensitivity',exact:true}).fill('6');
 await page.getByRole('combobox',{name:'Meter response',exact:true}).selectOption('quick');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 let saved=await(await page.request.get('/api/preferences')).json();expect(saved.prefs.graphicsMode).toBe('smooth');expect(saved.prefs.visualizerSensitivity).toBe(6);expect(saved.prefs.headerClock).toBe(false);
 await page.getByRole('button',{name:'Reset visualizer appearance',exact:true}).click();await page.getByRole('button',{name:'Save',exact:true}).click();saved=await(await page.request.get('/api/preferences')).json();expect(saved.prefs.visualizerSensitivity).toBe(0);expect(saved.prefs.graphicsMode).toBe('smooth');
 await page.getByRole('button',{name:'All settings',exact:true}).click();await page.getByRole('button',{name:'Now Playing',exact:true}).first().click();await expect(page.locator('.music2')).toHaveAttribute('data-performance','smooth');await expect(page.locator('.header-clock')).toHaveCount(0);
});
test('radio shows immediate pending feedback, binds the song, and asks before replacing queued music',async({page})=>{
 await configure(page);const state=await(await page.request.get('/api/state')).json(),key='a'.repeat(64);
 state.mode='music-assistant';state.musicAssistant={connected:true,status:'connected',controlEnabled:true};state.playback.queue[0].mediaKey=key;
 await page.route('**/api/state',r=>r.fulfill({json:state}));await page.route('**/api/events',r=>r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify(state)+'\n\n'}));
 const calls=[];let release;
 await page.route('**/api/library/radio',async r=>{calls.push(r.request().postDataJSON());if(calls.length===1){await new Promise(resolve=>release=resolve);return r.fulfill({status:409,json:{code:'queue-not-empty',upcoming:2}});}return r.fulfill({json:state});});
 await page.goto(url);await page.getByRole('button',{name:'Start song radio',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Start song radio',exact:true});
 await dialog.getByRole('button',{name:'Start radio',exact:true}).click();await expect(dialog.getByRole('button',{name:'Starting radio…'})).toBeDisabled();await expect.poll(()=>calls.length).toBe(1);release();
 await expect(dialog).toContainText('Starting radio will replace it.');expect(calls[0]).toEqual({mediaKey:key,confirmReplace:false});await dialog.getByRole('button',{name:'Replace queue and start radio',exact:true}).click();await expect(dialog).toHaveCount(0);expect(calls[1]).toEqual({mediaKey:key,confirmReplace:true});
});
test('the installed-build restart warning is painted before acknowledgement, and required restart can return to settings',async({page})=>{
 await configure(page);const info=await(await page.request.get('/api/updates')).json(),commit='b'.repeat(40);let phase='await-screen',acks=0;
 await page.route('**/api/updates',r=>r.fulfill({json:{...info,status:'installed',current:{commit,release:'test'},restart:{phase,commit,release:'test',remainingSeconds:2}}}));
 await page.route('**/api/updates/reboot-ready',r=>{acks++;return r.fulfill({json:{ready:true}});});
 await page.goto(url);const dialog=page.getByRole('dialog',{name:'Update installed',exact:true});await expect(dialog).toBeVisible();await expect(dialog).toContainText('Keep the power connected.');await expect.poll(()=>acks).toBe(1);phase='countdown';await expect(dialog).toContainText('2 seconds',{timeout:12000});phase='required';
 await expect(dialog).toContainText('Restart needed',{timeout:12000});await dialog.getByRole('button',{name:'Back to TuneBox',exact:true}).click();await expect(dialog).toHaveCount(0);await page.getByRole('button',{name:'Settings',exact:true}).click();
});
test('a generic phone name invites a nickname and persists only that phones name',async({browser})=>{
 const context=await browser.newContext({...devices['iPhone 13'],browserName:undefined,defaultBrowserType:undefined}),page=await context.newPage();let saved;
 try{
  await page.route('**/api/remote/session',r=>r.fulfill({json:{paired:true,name:'iPhone'}}));const view=remoteView({playback:{index:0,queue:[{title:'Song',artist:'Artist'}]}});
  await page.route('**/api/remote/events',r=>r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify(view)+'\n\n'}));
  await page.route('**/api/remote/name',r=>{saved=r.request().postDataJSON();return r.fulfill({json:{name:saved.name}});});
  await page.goto(test.info().project.use.baseURL+'/remote.html');const sheet=page.getByRole('dialog',{name:'Phone name',exact:true});await expect(sheet).toBeVisible();await sheet.getByRole('textbox',{name:'Phone name',exact:true}).fill('Guest one');await sheet.getByRole('button',{name:'Save',exact:true}).click();await expect(sheet).toHaveCount(0);expect(saved).toEqual({name:'Guest one'});
 }finally{await context.close();}
});
test('long song metadata remains readable and scrolls inside its own stable rows',async({page})=>{
 await configure(page);const state=await(await page.request.get('/api/state')).json();state.playback.queue[0].title='A very long song title with a live recording description and an extended edition that needs room';state.playback.queue[0].artist='The ensemble with a long name and additional performers';
 await page.route('**/api/state',r=>r.fulfill({json:state}));await page.route('**/api/events',r=>r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify(state)+'\n\n'}));await page.goto(url);
 const title=page.locator('.track-title');await expect(title).toHaveAttribute('data-overflow','true');expect(await title.locator('span').evaluate(n=>parseFloat(getComputedStyle(n).fontSize))).toBeGreaterThanOrEqual(34);expect(await title.getAttribute('title')).toBe(null);
 const before=await title.boundingBox();await page.waitForTimeout(1000);const after=await title.boundingBox();expect(after.y).toBeCloseTo(before.y,0);expect(after.width).toBeCloseTo(before.width,0);
});
test('a confirmed local underrun offers manual resume without a group or volume command',async({page})=>{
 await configure(page);const state=await(await page.request.get('/api/state')).json();state.mode='music-assistant';state.musicAssistant={connected:true,status:'connected'};state.localControl={needed:true,playbackFault:true,standby:true,recovery:{phase:'paused'}};
 await page.route('**/api/state',r=>r.fulfill({json:state}));await page.route('**/api/events',r=>r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify(state)+'\n\n'}));let body;
 await page.route('**/api/local',r=>{body=r.request().postDataJSON();state.localControl={needed:false,standby:false,recovery:{phase:'idle'}};return r.fulfill({json:state});});
 await page.goto(url);const dialog=page.getByRole('dialog',{name:'Playback needs attention',exact:true});await expect(dialog).toContainText('repeated underruns');await dialog.getByRole('button',{name:'Resume locally',exact:true}).click();await expect(dialog).toHaveCount(0);expect(body).toEqual({action:'resume'});
});
test('seeking to the end of a fractional-length song clamps to its duration and commits once',async({page})=>{
 await configure(page);const state=await(await page.request.get('/api/state')).json();state.playback.playing=false;state.playback.queue[0].duration=501.6;
 await page.route('**/api/state',r=>r.fulfill({json:state}));await page.route('**/api/events',r=>r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify(state)+'\n\n'}));const seeks=[];
 await page.route('**/api/event',r=>{const body=r.request().postDataJSON();if(body.type==='seek'){seeks.push(body.position);state.playback.position=body.position;}return r.fulfill({json:state});});
 await page.goto(url);const bar=page.getByRole('slider',{name:'Playback position',exact:true}),b=await bar.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width-1,b.y+b.height/2,{steps:8});expect(seeks).toHaveLength(0);await page.mouse.up();await expect.poll(()=>seeks.length).toBe(1);expect(seeks[0]).toBe(501.6);
});
test('a live station keeps elapsed time without running a frame animation for an unseekable bar',async({page})=>{
 await configure(page);const state=await(await page.request.get('/api/state')).json();state.playback.playing=true;state.playback.position=0;state.playback.observedAt=Date.now();state.playback.queue[0].duration=null;
 await page.route('**/api/state',r=>r.fulfill({json:state}));await page.route('**/api/events',r=>r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify(state)+'\n\n'}));
 await page.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);window.__rafRequests=0;window.requestAnimationFrame=fn=>{window.__rafRequests++;return raf(fn);};});
 await page.goto(url);await expect(page.getByRole('slider',{name:'Playback position',exact:true})).toBeDisabled();await page.waitForTimeout(4000);await page.evaluate(()=>window.__rafRequests=0);const before=await page.locator('.m2-times span').first().textContent();await page.waitForTimeout(1200);expect(await page.evaluate(()=>window.__rafRequests)).toBeLessThanOrEqual(8);await expect(page.locator('.m2-times span').first()).not.toHaveText(before);
});
test('the playhead moves between server snapshots, rests without animation work, and catches up after wake',async({page})=>{
 await configure(page);await page.request.post('/api/scenario',{data:{name:'Playback'}});await page.request.post('/api/event',{data:{type:'play'}});
 await page.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);window.__frames=0;window.requestAnimationFrame=fn=>{window.__frames++;return raf(fn);};});
 await page.goto(url);const bar=page.getByRole('slider',{name:'Playback position',exact:true});
 const first=Number(await bar.inputValue());await page.waitForTimeout(250);expect(Number(await bar.inputValue())).toBeGreaterThan(first);
 await page.getByRole('button',{name:'Screen rest',exact:true}).click();const rest=page.getByRole('button',{name:'Wake display',exact:true});await expect(rest).toBeVisible();await page.waitForTimeout(200);await page.evaluate(()=>window.__frames=0);await page.waitForTimeout(650);expect(await page.evaluate(()=>window.__frames)).toBeLessThanOrEqual(2);
 expect((await(await page.request.get('/api/state')).json()).playback.playing).toBe(true);
 await holdToWake(page,rest);await expect(rest).toHaveCount(0);expect(Number(await bar.inputValue())).toBeGreaterThan(first+.8);
});
