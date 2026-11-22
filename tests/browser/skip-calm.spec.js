import {test,expect} from '@playwright/test';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800},reducedMotion:'reduce'});
const art=c=>'/api/artwork/'+c.repeat(64);
const svg=color=>`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${color}"/></svg>`;
test.beforeEach(async({page})=>{const t=(await(await page.request.get('/api/updates')).json()).controlToken,headers={'X-TuneBox-Control':t};await page.request.post('/api/reset',{headers,data:{kind:'preferences',confirmed:true}});const p=await(await page.request.get('/api/preferences')).json();await page.request.post('/api/preferences',{headers,data:{revision:p.revision,patch:{setupCompleted:true,prefs:{...p.prefs,startupAnimation:'off'}}}});});
test('skipping keeps the old cover with a loading ring until Music Assistant reports the new track, without flashing back',async({page})=>{
 const base=await(await page.request.get('/api/state')).json();
 const make=index=>({...base,mode:'music-assistant',musicAssistant:{connected:true,status:'connected',playerId:'pi',controlEnabled:true,volumeLimit:40},playback:{...base.playback,connected:true,playerId:'pi',playing:true,position:5,observedAt:Date.now(),volume:20,capabilities:['volume_set'],index,
  queue:[{id:'t1',title:'First song',artist:'A',album:'X',duration:200,artwork:art('a')},{id:'t2',title:'Second song',artist:'B',album:'Y',duration:180,artwork:art('b')}]}});
 let state=make(0),events=[];
 await page.route('**/api/events',r=>r.abort());await page.route('**/api/state',r=>r.fulfill({json:state}));
 await page.route('**/api/artwork/**',r=>r.fulfill({contentType:'image/svg+xml',body:svg(r.request().url().endsWith('a')?'#c33':'#33c')}));
 // Like a slow Music Assistant: the command answers with the old track; the new one only arrives later.
 await page.route('**/api/event',async r=>{const body=r.request().postDataJSON();events.push(body.type);if(body.type==='next')return r.fulfill({json:make(0)});return r.continue();});
 await page.goto(url);const title=page.locator('.m2-playing h2');await expect(title).toHaveText('First song');
 await page.getByRole('button',{name:'Next track'}).click();
 await expect(page.locator('.m2-playing .artwork-loading')).toBeVisible();await expect(title).toHaveText('First song');
 state=make(1);await expect(title).toHaveText('Second song',{timeout:8000});await expect(page.locator('.m2-playing .artwork-loading')).toHaveCount(0);
 await expect(page.locator('.m2-playing .real-artwork img')).toHaveAttribute('src',art('b'));
 // A stale report of the old track right after the change does not bring it back.
 state=make(0);await page.waitForTimeout(1500);await expect(title).toHaveText('Second song');
 expect(events).toContain('next');
});
