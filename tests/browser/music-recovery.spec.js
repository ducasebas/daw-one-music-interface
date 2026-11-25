import {test,expect} from '@playwright/test';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800},reducedMotion:'reduce'});
async function fixture(page,phase='paused'){
 const token=(await(await page.request.get('/api/updates')).json()).controlToken,headers={'X-TuneBox-Control':token};
 await page.request.post('/api/reset',{headers,data:{kind:'preferences',confirmed:true}});
 const p=await(await page.request.get('/api/preferences')).json();await page.request.post('/api/preferences',{headers,data:{revision:p.revision,patch:{setupCompleted:true,prefs:{...p.prefs,startupAnimation:'off'}}}});
 const state=await(await page.request.get('/api/state')).json();
 Object.assign(state,{mode:'music-assistant',musicAssistant:{connected:false,status:'disconnected',players:[]},localControl:{needed:true,standby:phase==='paused',level:100,lowered:false,recovery:{phase}}});
 state.playback={...state.playback,connected:false};
 await page.route('**/api/events',r=>r.abort());await page.route('**/api/state',r=>r.fulfill({json:state}));
 return {state,token};
}
test('a connection check shows progress, can fail and retry, and does not resume until explicitly requested',async({page})=>{
 const f=await fixture(page),calls=[];let release;
 await page.route('**/api/music/reconnect',async r=>{calls.push('reconnect');await new Promise(resolve=>release=resolve);if(calls.length===1)return r.fulfill({status:503,json:{error:'Music Assistant is still unavailable. Check its server and network connection.',snapshot:f.state}});f.state.musicAssistant.connected=true;f.state.localControl.needed=false;return r.fulfill({json:{snapshot:f.state}});});
 await page.route('**/api/local',r=>{calls.push(r.request().postDataJSON().action);f.state.localControl.standby=false;return r.fulfill({json:f.state});});
 await page.goto(url);const bar=page.getByRole('region',{name:'Local control',exact:true});await expect(bar).toContainText('TuneBox is paused locally.');
 await expect(bar.getByRole('button')).toHaveCount(1);
 await bar.getByRole('button',{name:'Test connection again',exact:true}).click();const busy=bar.getByRole('button',{name:'Checking connection…',exact:true});await expect(busy).toBeDisabled();await expect(busy).toHaveAttribute('aria-busy','true');await expect(busy.locator('.is-spinning')).toBeVisible();
 release();await expect(bar.getByRole('alert')).toContainText('Music Assistant is still unavailable');await expect(bar.getByRole('button',{name:'Test connection again',exact:true})).toBeEnabled();
 await bar.getByRole('button',{name:'Test connection again',exact:true}).click();await expect(busy).toBeDisabled();release();
 await expect(bar.getByRole('button',{name:'Resume locally',exact:true})).toBeVisible();expect(calls).toEqual(['reconnect','reconnect']);
 await bar.getByRole('button',{name:'Resume locally',exact:true}).click();await expect(bar).toHaveCount(0);expect(calls).toEqual(['reconnect','reconnect','resume']);
});
test('pausing, a failed pause and a lost backend never claim an unconfirmed local pause',async({page})=>{
 const f=await fixture(page,'pausing');await page.goto(url);const bar=page.getByRole('region',{name:'Local control',exact:true});await expect(bar).toContainText('Pausing this TuneBox automatically…');await expect(bar.locator('.ui-spinner').first()).toBeVisible();
 f.state.localControl.recovery.phase='failed';await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect(bar).toContainText('Automatic local pause failed.');
 let pauses=0;await page.route('**/api/local',r=>{expect(r.request().postDataJSON()).toEqual({action:'pause'});pauses++;f.state.localControl.standby=true;f.state.localControl.recovery.phase='paused';return r.fulfill({json:f.state});});
 await bar.getByRole('button',{name:'Retry local pause',exact:true}).click();await expect(bar).toContainText('TuneBox is paused locally.');expect(pauses).toBe(1);
 await page.evaluate(()=>window.dispatchEvent(new Event('offline')));await expect(bar.getByRole('button',{name:'Test connection again',exact:true})).toBeDisabled();
});
test('an active Bluetooth source has no Music Assistant outage banner',async({page})=>{
 const f=await fixture(page);f.state.bluetooth={active:true,phase:'active'};await page.goto(url);await expect(page.locator('.music2')).toBeVisible();await expect(page.getByRole('region',{name:'Local control',exact:true})).toHaveCount(0);
});
test('automatic reconnection clears an earlier failed test without resuming local audio',async({page})=>{
 const f=await fixture(page);let controls=0;
 await page.route('**/api/music/reconnect',r=>r.fulfill({status:503,json:{snapshot:f.state,error:'Music Assistant is still unavailable. Check its server and network connection.'}}));
 await page.route('**/api/local',r=>{controls++;return r.abort();});
 await page.goto(url);const bar=page.getByRole('region',{name:'Local control',exact:true});await bar.getByRole('button',{name:'Test connection again',exact:true}).click();await expect(bar.getByRole('alert')).toBeVisible();
 f.state.musicAssistant.connected=true;f.state.localControl.needed=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await expect(bar.getByRole('button',{name:'Resume locally',exact:true})).toBeVisible();await expect(bar.getByRole('alert')).toHaveCount(0);expect(controls).toBe(0);
});
for(const height of [800,400])test(`outage controls remain readable and within the ${height}px display`,async({page})=>{
 await fixture(page);await page.setViewportSize({width:1280,height});await page.goto(url);const bar=page.getByRole('region',{name:'Local control',exact:true});await expect(bar).toBeVisible();const box=await bar.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(1280);expect(box.y+box.height).toBeLessThanOrEqual(height);await expect(bar.getByRole('button',{name:'Test connection again',exact:true})).toBeInViewport();
});
