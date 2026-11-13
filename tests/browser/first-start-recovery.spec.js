import {test,expect} from '@playwright/test';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800},reducedMotion:'reduce'});
async function token(page){return (await(await page.request.get('/api/updates')).json()).controlToken;}
async function patch(page,patch){const saved=await(await page.request.get('/api/preferences')).json();const r=await page.request.post('/api/preferences',{headers:{'X-TuneBox-Control':await token(page)},data:{revision:saved.revision,patch}});expect(r.ok()).toBe(true);}
async function firstStart(page,{live=false}={}){
 await page.route('**/api/events',r=>r.abort());
 await page.route('**/api/state',async r=>{const data=await(await r.fetch()).json();await r.fulfill({json:{...data,onboardingRequired:true,...(live?{mode:'music-assistant',musicAssistant:{connected:true,controlEnabled:true},playback:{...data.playback,connected:true,playing:true}}:{})}});});
 await page.goto(url);return page.getByRole('dialog',{name:'First start setup',exact:true});
}
test.beforeEach(async({page})=>{await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':await token(page)},data:{kind:'preferences',confirmed:true}});const saved=await(await page.request.get('/api/preferences')).json();await patch(page,{setupCompleted:false,setupDeferred:false,prefs:{...saved.prefs,startupAnimation:'off'}});await page.request.post('/api/scenario',{data:{name:'Playback'}});});
test.afterEach(async({page})=>{await patch(page,{setupCompleted:false,setupDeferred:false});await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':await token(page)},data:{kind:'preferences',confirmed:true}});});
test('Finish later leaves the first-start gate without claiming setup complete and stays dismissed after reload',async({page})=>{
 const commands=[];await page.route('**/api/device',r=>{commands.push(r.request().postDataJSON().command);return r.continue();});
 const wizard=await firstStart(page);await expect(wizard).toBeVisible();await wizard.getByRole('button',{name:'Finish later',exact:true}).click();await expect(wizard).not.toBeVisible();
 const prefs=await(await page.request.get('/api/preferences')).json();expect(prefs.setupDeferred).toBe(true);expect(prefs.setupCompleted).toBe(false);expect(commands).not.toContain('complete-setup');expect(commands).not.toContain('wifi');
 await page.reload();await expect(wizard).not.toBeVisible();await expect(page.locator('.music2')).toBeVisible();
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('navigation',{name:'Settings categories'}).getByRole('button',{name:'System',exact:true}).click();await page.getByRole('button',{name:'Open setup wizard',exact:true}).click();await expect(wizard).toBeVisible();
});
test('existing Ethernet and Music Assistant can be kept while music is playing without reconnecting or pausing',async({page})=>{
 await page.route('**/api/network',r=>r.fulfill({json:{supported:true,connected:true,type:'ethernet',interface:'eth0',interfaces:[{name:'eth0',type:'ethernet',state:'connected'}]}}));
 const commands=[];await page.route('**/api/device',r=>{const b=r.request().postDataJSON();commands.push(b.command);if(b.command==='wifi-scan')return r.fulfill({json:{supported:false,networks:[],interfaces:[],hotspotSupported:false}});return r.continue();});
 const wizard=await firstStart(page,{live:true});await wizard.getByRole('button',{name:'Next',exact:true}).click();await expect(wizard.getByText('Ethernet connected',{exact:true})).toBeVisible();await wizard.getByRole('button',{name:'Use current connection',exact:true}).click();await wizard.getByRole('button',{name:'Keep current connection',exact:true}).click();await expect(wizard.getByRole('button',{name:/5\s*Display/})).toHaveAttribute('aria-current','step');
 expect(commands).not.toContain('wifi');expect(commands).not.toContain('save-music');expect((await(await page.request.get('/api/state')).json()).playback.playing).toBe(true);
});
test('network failure can be skipped and skipping Music Assistant bypasses the dependent player step',async({page})=>{
 await page.route('**/api/network',r=>r.abort());await page.route('**/api/device',r=>r.request().postDataJSON().command==='wifi-scan'?r.fulfill({status:409,json:{error:'Device action already running'}}):r.continue());
 const wizard=await firstStart(page);await wizard.getByRole('button',{name:'Next',exact:true}).click();await expect(wizard.getByText('Device action already running',{exact:true})).toBeVisible();await wizard.getByRole('button',{name:'Skip this step',exact:true}).click();await expect(wizard.getByRole('button',{name:/3\s*Music Assistant/})).toHaveAttribute('aria-current','step');await wizard.getByRole('button',{name:'Skip this step',exact:true}).click();await expect(wizard.getByRole('button',{name:/5\s*Display/})).toHaveAttribute('aria-current','step');await wizard.getByRole('button',{name:'Next',exact:true}).click();await wizard.getByRole('button',{name:'Finish for now',exact:true}).click();await expect(wizard).not.toBeVisible();const prefs=await(await page.request.get('/api/preferences')).json();expect(prefs.setupDeferred).toBe(true);expect(prefs.setupCompleted).toBe(false);
});
test('a slow server probe cannot jump back into Player after the user skips it',async({page})=>{
 let release;const gate=new Promise(r=>release=r);await page.route('**/api/device',async r=>{if(r.request().postDataJSON().command==='probe-music'){await gate;return r.fulfill({json:{players:[{id:'pi',name:'TuneBox',available:true}]}});}return r.continue();});
 const wizard=await firstStart(page);await wizard.getByRole('button',{name:/3\s*Music Assistant/}).click();await wizard.getByLabel('Music Assistant server address',{exact:true}).fill('http://localhost:8095');const done=page.getByRole('button',{name:'Done typing',exact:true});if(await done.isVisible())await done.click();await wizard.getByRole('button',{name:'Test connection',exact:true}).click();await expect(wizard.getByRole('button',{name:'Testing connection…',exact:true})).toBeVisible();const response=page.waitForResponse(r=>r.url().endsWith('/api/device')&&r.request().postDataJSON()?.command==='probe-music');await wizard.getByRole('button',{name:'Skip this step',exact:true}).click();release();await expect(wizard.getByRole('button',{name:/5\s*Display/})).toHaveAttribute('aria-current','step');await response;await expect(wizard.getByRole('button',{name:/5\s*Display/})).toHaveAttribute('aria-current','step');
});
test('joining Wi-Fi explicitly acknowledges possible music interruption and keeps credentials out of browser storage',async({page})=>{
 await page.route('**/api/network',r=>r.fulfill({json:{connected:true,type:'wifi',ssid:'Old network'}}));const joins=[];await page.route('**/api/device',r=>{const b=r.request().postDataJSON();if(b.command==='wifi-scan')return r.fulfill({json:{supported:true,interface:'wlan0',networks:[{ssid:'Studio',security:'WPA2',signal:90}]}});if(b.command==='wifi'){joins.push(b.args);return r.fulfill({json:{connected:true}});}return r.continue();});
 const wizard=await firstStart(page,{live:true});await wizard.getByRole('button',{name:'Next',exact:true}).click();await wizard.getByRole('button',{name:/Studio/}).click();const keyboard=page.getByRole('dialog',{name:'Touch keyboard',exact:true});await keyboard.getByLabel('Keyboard entry',{exact:true}).fill('not-in-storage');await keyboard.getByRole('button',{name:'Done typing',exact:true}).click();const join=page.getByRole('dialog',{name:'Join Wi-Fi network',exact:true});await expect(join).toContainText('may interrupt music');await join.getByRole('button',{name:'Join network',exact:true}).click();await expect(join).not.toBeVisible();expect(joins).toEqual([{interface:'wlan0',ssid:'Studio',password:'not-in-storage',confirmed:true}]);expect(await page.evaluate(()=>JSON.stringify({...localStorage}))).not.toContain('not-in-storage');await expect(wizard.locator('.network-current').getByText('Studio',{exact:true})).toBeVisible();
});

test('Finish later can dismiss a locked first-start screen while protected settings still require the PIN',async({page})=>{
 const pin='572941',headers={'X-TuneBox-Control':await token(page)};
 try{
  expect((await page.request.post('/api/security/set-pin',{headers,data:{pin,confirmation:pin}})).ok()).toBe(true);
  await page.request.post('/api/security/lock',{headers,data:{}});
  const wizard=await firstStart(page);await wizard.getByRole('button',{name:'Finish later',exact:true}).click();await expect(wizard).not.toBeVisible();
  const security=await(await page.request.get('/api/security/status')).json();expect(security.enabled).toBe(true);expect(security.unlocked).toBe(false);
  const prefs=await(await page.request.get('/api/preferences')).json();expect(prefs.setupDeferred).toBe(true);expect(prefs.setupCompleted).toBe(false);
  const denied=await page.request.post('/api/preferences',{headers,data:{revision:prefs.revision,patch:{maxVolume:50}}});expect(denied.status()).toBe(423);
  expect((await page.request.post('/api/setup/defer',{headers,data:{maxVolume:50}})).status()).toBe(400);
  expect((await page.request.post('/api/setup/defer',{data:{}})).status()).toBe(403);
 }finally{await page.request.post('/api/security/unlock',{headers,data:{pin}});await page.request.post('/api/security/disable',{headers,data:{}});}
});
