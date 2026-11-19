import {test,expect} from '@playwright/test';
import {chooseSettingsSection} from './settings-helpers.js';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800},reducedMotion:'reduce'});
async function token(page){return (await(await page.request.get('/api/updates')).json()).controlToken;}
test.beforeEach(async({page})=>{
 const headers={'X-TuneBox-Control':await token(page)};await page.request.post('/api/reset',{headers,data:{kind:'preferences',confirmed:true}});
 const saved=await(await page.request.get('/api/preferences')).json();await page.request.post('/api/preferences',{headers,data:{revision:saved.revision,patch:{prefs:{...saved.prefs,startupAnimation:'off'}}}});
 await page.request.post('/api/scenario',{data:{name:'Playback'}});
});
async function live(page,extra={}){
 const state=await(await page.request.get('/api/state')).json();Object.assign(state,{mode:'music-assistant',musicAssistant:{connected:true,playerId:'pi',controlEnabled:true,volumeLimit:40},...extra});
 state.playback={...state.playback,connected:true,playerId:'pi',playing:false,volume:20,capabilities:['volume_set','volume_mute','seek'],queue:[{id:'track',title:'Local music',artist:'Artist',album:'Album',duration:240}],index:0};
 await page.route('**/api/events',r=>r.abort());await page.route('**/api/state',r=>r.fulfill({json:state}));return state;
}
test('larger header icons and artwork fit the physical display without hiding playback',async({page})=>{
 await page.goto(url);await expect(page.locator('.m2-playing')).toBeVisible();
 const cover=await page.locator('.m2-playing>.m2-cover').boundingBox();expect(cover.width).toBeGreaterThanOrEqual(330);expect(cover.height).toBeGreaterThanOrEqual(330);
 for(const icon of await page.locator('.m2-header>nav .tb-icon').all()){await expect(icon).toBeVisible();expect((await icon.boundingBox()).width).toBeGreaterThanOrEqual(32);}
 expect(await page.locator('.m2-header').evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await expect(page.locator('.m2-player')).toBeInViewport();
 await page.screenshot({path:'test-results/connect-now-playing.png'});
});
test('keyboard shows current MA suggestions and a tap starts the selected track',async({page})=>{
 const state=await live(page),plays=[];
 await page.route('**/api/library?*',async r=>{const q=new URL(r.request().url()).searchParams.get('q')||'';if(q==='old')await new Promise(r=>setTimeout(r,800));await r.fulfill({json:{items:q?[{id:'track1',type:'track',name:q==='new'?'New song':'Old song',artist:'Artist',available:true}]:[],hasMore:false}}).catch(()=>{});});
 await page.route('**/api/library/play',r=>{plays.push(r.request().postDataJSON());return r.fulfill({json:state});});
 await page.goto(url);await page.locator('.m2-header').getByRole('button',{name:'Search',exact:true}).click();
 const keyboard=page.getByRole('dialog',{name:'Touch keyboard',exact:true}),input=keyboard.getByLabel('Keyboard entry',{exact:true});
 await input.fill('old');await page.waitForTimeout(300);await input.fill('new');
 const suggestions=keyboard.getByRole('region',{name:'Music suggestions',exact:true});await expect(suggestions.getByRole('button',{name:'New song Artist',exact:true})).toBeVisible();await page.waitForTimeout(850);await expect(suggestions).not.toContainText('Old song');
 await page.screenshot({path:'test-results/connect-suggestions.png'});await suggestions.getByRole('button',{name:'New song Artist',exact:true}).click();await expect(keyboard).not.toBeVisible();await expect(page.locator('.music2')).toHaveAttribute('data-page','playing');expect(plays).toEqual([{id:'track1',option:'replace'}]);
});
test('Music Assistant favorites wait for acknowledgement and refresh their visible state',async({page})=>{
 await live(page);let favorite=false;const writes=[];
 await page.route('**/api/library?*',r=>r.fulfill({json:{items:[{id:'a1',type:'album',name:'Favorite album',artist:'Artist',available:true,favorite}],hasMore:false}}));
 await page.route('**/api/library/favorite',r=>{writes.push(r.request().postDataJSON());favorite=true;return r.fulfill({json:{saved:true}});});
 await page.goto(url);await page.locator('.m2-header').getByRole('button',{name:'My music',exact:true}).click();
 await page.getByRole('button',{name:'Add Favorite album to favorites',exact:true}).click();await expect(page.getByRole('button',{name:'Remove Favorite album from favorites',exact:true})).toHaveAttribute('aria-pressed','true');expect(writes).toEqual([{id:'a1',enabled:true}]);
 await expect(page.getByLabel('Music source',{exact:true})).toContainText('YouTube Music');
});
test('calibration upload accepts a real microphone text format and stays device-owned on the Pi',async({page})=>{
 await page.goto('/?gui=2&panel=wall-16-10');await chooseSettingsSection(page,'Room measurement',{open:true});await page.getByRole('button',{name:'Microphone',exact:true}).click();
 const file=page.getByLabel('Microphone calibration file',{exact:true});await file.setInputFiles({name:'700-1234_90deg.txt',mimeType:'text/plain',buffer:Buffer.from('"Sens Factor =-0.7dB, SERNO: 7001234"\n20 0\n1000 1\n20000 -1\n')});
 await expect(page.getByRole('button',{name:'Remove calibration curve',exact:true})).toBeVisible();await page.getByRole('button',{name:'Save room profile',exact:true}).click();
 expect((await(await page.request.get('/api/measurement/profile')).json()).calibration).toEqual([[20,0],[1000,1],[20000,-1]]);
 await page.goto(url);await chooseSettingsSection(page,'Room measurement',{open:true});await page.getByRole('button',{name:'Microphone',exact:true}).click();await expect(page.getByLabel('Microphone calibration file',{exact:true})).toBeDisabled();
 await expect(page.getByText('Open TuneBox on your computer to upload the calibration file. The curve is saved on TuneBox and appears here.',{exact:true})).toBeVisible();
});
test('Bluetooth pairing is an owned code confirmation and never unmutes automatically',async({page})=>{
 const sessionId='f'.repeat(8)+'-ffff-ffff-ffff-'+ 'f'.repeat(12),state=await live(page,{bluetooth:{supported:true,active:true,sessionId,phase:'active',available:true,volume:0,limit:40,devices:[{name:'My phone',connected:true}],pairing:{nonce:'a'.repeat(32),code:'123456',name:'My phone'}}}),writes=[];
 await page.route('**/api/device',r=>{const b=r.request().postDataJSON();if(b.command.startsWith('bluetooth-')){writes.push(b);state.bluetooth.pairing=null;return r.fulfill({json:{confirmed:true}});}return r.continue();});
 await page.route('**/api/event',r=>{const e=r.request().postDataJSON();if(e.type==='volume'){writes.push(e);state.bluetooth.volume=e.value;return r.fulfill({json:state});}return r.continue();});
 await page.goto(url);const dialog=page.getByRole('dialog',{name:'Confirm Bluetooth pairing',exact:true});await expect(dialog).toContainText('123456');await dialog.getByRole('button',{name:'Codes match',exact:true}).click();await expect(dialog).not.toBeVisible();
 await expect(page.locator('.bluetooth-playing')).toBeVisible();await expect(page.getByRole('button',{name:'Play',exact:true})).toBeDisabled();
 const plus=page.locator('.m2-player').getByRole('button',{name:'Volume up',exact:true});await plus.click();await expect.poll(()=>writes.filter(e=>e.type==='volume').length).toBe(1);expect(writes.find(e=>e.type==='volume')).toEqual({type:'volume',value:5,sourceId:sessionId});expect(writes[0]).toEqual({command:'bluetooth-confirm',args:{nonce:'a'.repeat(32),accept:true}});
 await page.screenshot({path:'test-results/connect-bluetooth.png'});
});
test('search suggestions start at 3 characters, debounce, reuse prefixes and stay above the keyboard',async({page})=>{
 await live(page);const asked=[];
 await page.route('**/api/library?*',async r=>{const q=new URL(r.request().url()).searchParams.get('q');if(q!==null)asked.push(q);await r.fulfill({json:{items:q?[{id:'t-'+q,type:'track',name:'Song '+q,artist:'Artist',available:true}]:[],hasMore:false}}).catch(()=>{});});
 await page.goto(url);await page.locator('.m2-header').getByRole('button',{name:'Search',exact:true}).click();
 const keyboard=page.getByRole('dialog',{name:'Touch keyboard',exact:true}),input=keyboard.getByLabel('Keyboard entry',{exact:true}),suggestions=keyboard.getByRole('region',{name:'Music suggestions',exact:true});
 await input.fill('ab');await page.waitForTimeout(400);
 expect(asked).toEqual([]);await expect(suggestions).toContainText('Type at least 3 characters');
 // Quick typing sends only the final query.
 await input.fill('abb');await page.waitForTimeout(80);await input.fill('abba');
 await expect(suggestions.getByRole('button',{name:'Song abba Artist',exact:true})).toBeVisible();
 expect(asked).toEqual(['abba']);
 await input.fill('abb');await expect(suggestions.getByRole('button',{name:'Song abb Artist',exact:true})).toBeVisible();
 await input.fill('abba');await expect(suggestions.getByRole('button',{name:'Song abba Artist',exact:true})).toBeVisible();await page.waitForTimeout(400);
 expect(asked).toEqual(['abba','abb'],'a prefix seen before is answered from the cache');
 const shown=await suggestions.boundingBox(),keys=await keyboard.locator('.keyboard-keys').boundingBox();
 expect(shown.y+shown.height).toBeLessThanOrEqual(keys.y+1);expect(shown.y).toBeGreaterThanOrEqual(0);
});
test('a Music Assistant player without native seek can still be scrubbed through its queue',async({page})=>{
 const state=await live(page);state.playback.capabilities=['volume_set','volume_mute','queue_seek'];state.playback.queueId='pi';
 const seeks=[];await page.route('**/api/event',r=>{const e=r.request().postDataJSON();if(e.type==='seek')seeks.push(e.position);return r.fulfill({json:state});});
 await page.goto(url);await page.getByRole('button',{name:'Now Playing',exact:true}).first().click();
 const seek=page.locator('.seek-control input');await expect(seek).toBeEnabled();
 const box=await seek.boundingBox();await page.touchscreen.tap(box.x+10+(box.width-20)*.5,box.y+box.height/2);
 await expect.poll(()=>seeks.length).toBe(1);expect(Math.abs(seeks[0]-120)).toBeLessThanOrEqual(8);
 state.playback.capabilities=['volume_set','volume_mute'];await page.reload();await page.getByRole('button',{name:'Now Playing',exact:true}).first().click();await expect(seek).toBeDisabled();
});
test('a player without native mute can still be muted from Now Playing',async({page})=>{
 const state=await live(page);state.playback.capabilities=['volume_set','volume_mute_soft'];
 const sent=[];await page.route('**/api/event',r=>{const e=r.request().postDataJSON();sent.push(e);if(e.type==='mute'){state.playback.muted=e.value;}return r.fulfill({json:state});});
 await page.goto(url);await page.getByRole('button',{name:'Now Playing',exact:true}).first().click();
 const mute=page.locator('.m2-player').getByRole('button',{name:'Mute',exact:true});await expect(mute).toBeEnabled();
 await mute.click();await expect.poll(()=>sent.filter(e=>e.type==='mute').length).toBe(1);expect(sent.find(e=>e.type==='mute')).toEqual({type:'mute',value:true});
 state.playback.capabilities=['volume_set'];await page.reload();await page.getByRole('button',{name:'Now Playing',exact:true}).first().click();
 await expect(page.locator('.m2-player').getByRole('button',{name:/^(Mute|Unmute)$/})).toBeDisabled();
});
