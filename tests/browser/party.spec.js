import {test,expect} from '@playwright/test';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800},reducedMotion:'reduce'});
async function token(page){return (await(await page.request.get('/api/updates')).json()).controlToken;}
test.beforeEach(async({page})=>{const headers={'X-TuneBox-Control':await token(page)};await page.request.post('/api/reset',{headers,data:{kind:'preferences',confirmed:true}});const p=await(await page.request.get('/api/preferences')).json();await page.request.post('/api/preferences',{headers,data:{revision:p.revision,patch:{setupCompleted:true,prefs:{...p.prefs,startupAnimation:'off',widgets:['clock','party']}}}});await page.request.post('/api/scenario',{data:{name:'Playback'}});});
test.afterAll(async({request})=>{const t=(await(await request.get('/api/updates')).json()).controlToken;await request.post('/api/reset',{headers:{'X-TuneBox-Control':t},data:{kind:'preferences',confirmed:true}});await request.post('/api/remote/party',{headers:{'X-TuneBox-Control':t},data:{action:'cancel'}});});
test('the Party widget opens the phone code on Now Playing and explains PIN, phones, keep playing and rooms',async({page})=>{
 const calls=[];page.on('request',r=>{if(r.url().endsWith('/api/remote/party'))calls.push(r.postDataJSON().action);});
 await page.route('**/api/remote/party',async r=>{const action=r.request().postDataJSON().action;return r.fulfill({json:action==='start'?{phones:0,pairing:true,pinRequired:false,url:'http://192.168.1.20:3003/remote.html#pair='+'a'.repeat(48),expiresAt:Date.now()+600000}:{phones:0,pairing:false}});});
 await page.goto(url);await page.getByRole('button',{name:'Now Playing',exact:true}).first().click();
 await page.locator('.np-widgets [data-widget=party]').click();
 const sheet=page.getByRole('dialog',{name:'Party',exact:true});await expect(sheet).toBeVisible();
 await expect(sheet.getByRole('img',{name:'Scan with your phone camera'})).toBeVisible();
 await expect(sheet).toContainText('No PIN is set');await expect(sheet).toContainText('0 phones paired');await expect(sheet).toContainText('Other rooms are not affected');
 await expect(sheet).toContainText('Code valid for');
 await page.screenshot({path:'test-results/party-sheet.png'});
 await sheet.getByRole('button',{name:'Close',exact:true}).click();await expect(sheet).toHaveCount(0);
 await expect.poll(()=>calls).toEqual(['start','cancel']);
});
