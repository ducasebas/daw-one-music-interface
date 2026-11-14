import {test,expect} from '@playwright/test';

const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800}});
test.beforeEach(async({page})=>{
 // Exercise the remote API wake itself; startup's browser wake is covered by
 // the wall suite and must not undo this test's simulated idle timeout.
 await page.route('**/api/activity',route=>route.fulfill({json:{ok:true}}));
 const token=(await(await page.request.get('/api/updates')).json()).controlToken;
 await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':token},data:{kind:'preferences',confirmed:true}});
 await page.request.post('/api/scenario',{data:{name:'Playback'}});
 const preferences=await(await page.request.get('/api/preferences')).json();
 await page.request.post('/api/preferences',{headers:{'X-TuneBox-Control':token},data:{revision:preferences.revision,patch:{prefs:{...preferences.prefs,screen:{...preferences.prefs.screen,mode:'black'}}}}});
 await page.goto(url);await page.locator('.startup-screen').waitFor({state:'hidden'});await expect(page.locator('.m2-header')).toBeVisible();
});
test('a remote wake removes manually entered black screen rest without changing playback',async({page})=>{
 const before=await(await page.request.get('/api/state')).json();
 await page.getByRole('button',{name:'Screen rest',exact:true}).tap();
 const screen=page.getByRole('button',{name:'Wake display',exact:true});await expect(screen).toHaveAttribute('data-mode','black');
 await expect.poll(async()=>(await(await page.request.get('/api/state')).json()).device.displayAwake).toBe(false);
 await page.request.post('/api/activity');
 await expect.poll(async()=>(await(await page.request.get('/api/state')).json()).device.displayAwake).toBe(true);
 await expect(screen).not.toBeVisible();
 const after=await(await page.request.get('/api/state')).json();expect(after.playback.playing).toBe(before.playback.playing);expect(after.device.amplifierEnabled).toBe(before.device.amplifierEnabled);
});
test('a remote wake also clears automatic screen rest',async({page})=>{
 await page.request.post('/api/event',{data:{type:'display-timeout'}});
 const screen=page.getByRole('button',{name:'Wake display',exact:true});await expect(screen).toBeVisible();
 await page.request.post('/api/activity');await expect(screen).not.toBeVisible();
});
test('a rejected manual sleep request cannot leave a black layer over an awake interface',async({page})=>{
 await page.route('**/api/event',route=>route.request().postDataJSON().type==='display-timeout'?route.fulfill({status:409,json:{error:'Screen rest temporarily unavailable'}}):route.continue());
 await page.getByRole('button',{name:'Screen rest',exact:true}).tap();
 await expect(page.getByRole('button',{name:'Wake display',exact:true})).not.toBeVisible();
 await expect(page.getByRole('button',{name:'Screen rest',exact:true})).toBeVisible();
 expect((await(await page.request.get('/api/state')).json()).device.displayAwake).toBe(true);
});
