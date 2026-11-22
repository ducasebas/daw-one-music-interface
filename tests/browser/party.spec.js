import {test,expect} from '@playwright/test';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800},reducedMotion:'reduce'});
async function token(page){return (await(await page.request.get('/api/updates')).json()).controlToken;}
test.beforeEach(async({page})=>{const headers={'X-TuneBox-Control':await token(page)};await page.request.post('/api/remote/forget',{headers,data:{all:true}});await page.request.post('/api/reset',{headers,data:{kind:'preferences',confirmed:true}});const p=await(await page.request.get('/api/preferences')).json();await page.request.post('/api/preferences',{headers,data:{revision:p.revision,patch:{setupCompleted:true,prefs:{...p.prefs,startupAnimation:'off',widgets:['clock','party']}}}});await page.request.post('/api/scenario',{data:{name:'Playback'}});});
test.afterAll(async({request})=>{const t=(await(await request.get('/api/updates')).json()).controlToken;await request.post('/api/reset',{headers:{'X-TuneBox-Control':t},data:{kind:'preferences',confirmed:true}});await request.post('/api/remote/party',{headers:{'X-TuneBox-Control':t},data:{action:'cancel'}});});
test('the Party widget opens the phone code on Now Playing and explains PIN, phones, keep playing and rooms',async({page})=>{
 const calls=[];page.on('request',r=>{if(r.url().endsWith('/api/remote/party'))calls.push(r.postDataJSON().action);});
 await page.route('**/api/remote/party',async r=>{const action=r.request().postDataJSON().action;return r.fulfill({json:action==='start'?{phones:0,pairing:true,pinRequired:false,url:'http://192.168.1.20:3003/remote.html#pair='+'a'.repeat(48),expiresAt:Date.now()+600000}:{phones:0,pairing:false}});});
 await page.goto(url);await page.getByRole('button',{name:'Now Playing',exact:true}).first().click();
 await page.locator('.np-widgets [data-widget=party]').click();
 const sheet=page.getByRole('dialog',{name:'Party mode',exact:true});await expect(sheet).toBeVisible();
 await expect(sheet.getByRole('img',{name:'Scan with your phone camera'})).toBeVisible();
 await expect(sheet).toContainText('No PIN is set');await expect(sheet).toContainText('0 phones paired');await expect(sheet).toContainText('Other rooms are not affected');
 await expect(sheet).toContainText('Code valid for');
 await page.screenshot({path:'test-results/party-sheet.png'});
 await sheet.getByRole('button',{name:'Close',exact:true}).click();await expect(sheet).toHaveCount(0);
 await expect.poll(()=>calls).toEqual(['start','cancel']);
});
test('with Music Assistant away, Now Playing offers local pause and volume that never goes above the previous level',async({page})=>{
 const state=await(await page.request.get('/api/state')).json();
 Object.assign(state,{mode:'music-assistant',musicAssistant:{connected:false,status:'disconnected',players:[]},localControl:{needed:true,standby:false,level:100,lowered:false}});
 state.playback={...state.playback,connected:false};const sent=[];
 await page.route('**/api/events',r=>r.abort());await page.route('**/api/state',r=>r.fulfill({json:state}));
 await page.route('**/api/local',r=>{const a=r.request().postDataJSON().action;sent.push(a);const l=state.localControl;if(a==='pause')l.standby=true;if(a==='resume')l.standby=false;if(a==='quieter')l.level=Math.max(0,l.level-10);if(a==='louder')l.level=Math.min(100,l.level+10);l.lowered=l.level<100;return r.fulfill({json:state});});
 await page.goto(url);await page.getByRole('button',{name:'Now Playing',exact:true}).first().click();
 const bar=page.getByRole('region',{name:'Local control',exact:true});await expect(bar).toContainText('Music Assistant is unavailable');
 const louder=bar.getByRole('button',{name:'Louder, up to the previous level',exact:true});await expect(louder).toBeDisabled();
 await bar.getByRole('button',{name:'Quieter',exact:true}).click();await expect.poll(()=>sent).toEqual(['quieter']);
 await page.screenshot({path:'test-results/local-control.png'});
 await bar.getByRole('button',{name:'Pause locally',exact:true}).click();await expect.poll(()=>sent.at(-1)).toBe('pause');
});
test('a ready local Music Assistant shows a setup QR and connects TuneBox with the local address prefilled',async({page})=>{
 await page.route('**/api/device',async r=>{const b=r.request().postDataJSON();if(b.command==='local-ma-status')return r.fulfill({json:{simulated:false,capacity:{eligible:true,reasons:[]},dockerAvailable:true,installing:false,job:{phase:'ready'}}});return r.continue();});
 await page.route('**/api/local-ma/address',r=>r.fulfill({json:{url:'http://192.168.1.20:8095'}}));
 const {chooseDeveloperTopic}=await import('./settings-helpers.js');
 await page.goto(url);await chooseDeveloperTopic(page,'Services',{open:true});
 const steps=page.locator('.local-ma-steps li');await expect(steps).toHaveCount(4);await expect(steps.nth(2)).toHaveAttribute('data-state','current');
 await expect(page.getByRole('img',{name:'Open on your phone or computer'})).toBeVisible();await expect(page.locator('.local-ma-ready code')).toHaveText('http://192.168.1.20:8095');
 await page.getByRole('button',{name:'Connect TuneBox to this server',exact:true}).click();
 const wizard=page.getByRole('dialog',{name:'Music Assistant setup',exact:true});
 await expect(wizard.getByLabel('Music Assistant server address',{exact:true})).toHaveValue('http://127.0.0.1:8095');
});
