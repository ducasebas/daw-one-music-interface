import {test,expect} from '@playwright/test';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800}});
const room=(id,state,extra={})=>({id,name:id==='pi'?'TuneBox':'Rivo',provider:'squeezelite',type:'player',available:true,state,volume:id==='pi'?20:100,muted:false,canVolume:true,canMute:true,canGroup:true,canGroupWith:['pi','rivo'],parentId:null,members:[],staticMembers:[],title:state==='playing'?'Near Light':'',artist:'Ólafur Arnalds',isLocal:id==='pi',...extra});
async function fixture(page,{local={},locked=false,deferred=false,updating=false}={}){
 const token=(await(await page.request.get('/api/updates')).json()).controlToken;
 await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':token},data:{kind:'preferences',confirmed:true}});await page.request.post('/api/scenario',{data:{name:'Playback'}});await page.request.post('/api/event',{data:{type:'pause'}});
 const s=await(await page.request.get('/api/state')).json();s.mode='music-assistant';s.musicAssistant={...s.musicAssistant,mode:'music-assistant',connected:true,controlEnabled:true,status:'connected',playerId:'pi'};s.playback.connected=true;s.onboardingRequired=false;
 if(deferred){s.onboardingRequired=true;s.preferences.setupDeferred=true;}
 const data={configured:true,connected:true,controlEnabled:true,locked,localId:'pi',selectedId:'pi',bootId:'boot-one',revision:'a'.repeat(64),limit:40,rooms:[room('pi','idle',local),room('rivo','playing')],busy:false};const f={data,calls:[],reads:0,delay:0,earlyState:false};
 await page.route('**/api/events',r=>r.abort());await page.route('**/api/state',r=>r.fulfill({json:s}));
 if(locked)await page.route('**/api/security/status',r=>r.fulfill({json:{enabled:true,unlocked:false,remainingSeconds:0}}));
 if(updating){const info=await(await page.request.get('/api/updates')).json();await page.route('**/api/updates',r=>r.fulfill({json:{...info,status:'installing',manager:{...info.manager,simulated:true}}}));}
 await page.route('**/api/rooms',async r=>{
  if(r.request().method()==='GET'){f.reads++;return r.fulfill({json:data});}
  const body=r.request().postDataJSON();f.calls.push(body);if(f.earlyState){data.rooms[0].parentId='rivo';data.rooms[0].state='playing';}if(f.delay)await new Promise(resolve=>setTimeout(resolve,f.delay));
  data.rooms[0].parentId='rivo';data.rooms[0].state='playing';data.rooms[1].members=['pi'];return r.fulfill({json:{rooms:data}});
 });
 await page.goto(url);return f;
}
const prompt=page=>page.getByRole('dialog',{name:'Join existing music',exact:true});
test('startup asks after the splash and joins the playing Rivo only after an explicit tap',async({page})=>{
 const f=await fixture(page);f.delay=4500;f.earlyState=true;
 if(await page.locator('.startup-screen').isVisible())await expect(prompt(page)).toHaveCount(0);
 await expect(prompt(page)).toBeVisible({timeout:10000});await expect(prompt(page)).toContainText('may briefly interrupt');expect(f.calls).toHaveLength(0);const b=await prompt(page).boundingBox();expect(b.y).toBeGreaterThanOrEqual(0);expect(b.y+b.height).toBeLessThanOrEqual(800);await page.screenshot({path:'test-results/startup-join.png',animations:'disabled'});
 await prompt(page).getByRole('button',{name:'Join Rivo',exact:true}).click();await expect(prompt(page)).toContainText('Synchronizing…');await expect(prompt(page).getByRole('button',{name:'Keep separate',exact:true})).toBeDisabled();
 await page.waitForTimeout(3200);await expect(prompt(page)).toBeVisible();
 await expect(prompt(page)).toHaveCount(0);expect(f.calls).toEqual([{action:'join',playerId:'pi',targetId:'rivo',revision:'a'.repeat(64),confirmed:true}]);
});
test('keep separate sends no player command and persists for this boot across page reloads',async({page})=>{
 const f=await fixture(page);await expect(prompt(page)).toBeVisible({timeout:10000});await prompt(page).getByRole('button',{name:'Keep separate',exact:true}).click();await expect(prompt(page)).toHaveCount(0);
 const reads=f.reads;await page.reload();await page.locator('.startup-screen').waitFor({state:'hidden'});await expect.poll(()=>f.reads).toBeGreaterThan(reads);await expect(prompt(page)).toHaveCount(0);expect(f.calls).toHaveLength(0);
 f.data.bootId='boot-two';await page.reload();await expect(prompt(page)).toBeVisible({timeout:10000});expect(f.calls).toHaveLength(0);
});
test('a source that stops playing cannot be joined from an old startup prompt',async({page})=>{
 const f=await fixture(page);await expect(prompt(page)).toBeVisible({timeout:10000});f.data.rooms[1].state='paused';await expect(prompt(page).getByRole('button',{name:'Join Rivo',exact:true})).toHaveCount(0);expect(f.calls).toHaveLength(0);
});
test('an already grouped or playing TuneBox does not receive a redundant join question',async({page})=>{
 const f=await fixture(page,{local:{parentId:'rivo'}});await page.locator('.startup-screen').waitFor({state:'hidden'});await expect.poll(()=>f.reads).toBeGreaterThan(0);await expect(prompt(page)).toHaveCount(0);expect(f.calls).toHaveLength(0);
 f.data.bootId='playing-boot';f.data.rooms[0].parentId=null;f.data.rooms[0].state='playing';const reads=f.reads;await page.reload();await page.locator('.startup-screen').waitFor({state:'hidden'});await expect.poll(()=>f.reads).toBeGreaterThan(reads);await expect(prompt(page)).toHaveCount(0);
});
test('startup keeps a high local volume blocked while retaining the playing room volume',async({page})=>{
 const f=await fixture(page,{local:{volume:70}});await expect(prompt(page)).toBeVisible({timeout:10000});await expect(prompt(page).getByRole('button',{name:'Join Rivo',exact:true})).toBeDisabled();await expect(prompt(page)).toContainText('Check or lower TuneBox volume');expect(f.data.rooms[1].volume).toBe(100);expect(f.calls).toHaveLength(0);
});
test('a protected startup group change offers the normal PIN unlock without sending a join',async({page})=>{
 const f=await fixture(page,{locked:true});await expect(prompt(page)).toBeVisible({timeout:10000});await expect(prompt(page).getByRole('button',{name:'Join Rivo',exact:true})).toBeDisabled();await prompt(page).getByRole('button',{name:'Unlock settings to join',exact:true}).click();await expect(page.getByRole('heading',{name:'Unlock settings',exact:true})).toBeVisible();expect(f.calls).toHaveLength(0);
});
test('finishing setup later still permits an explicit startup join after reaching the music screen',async({page})=>{
 const f=await fixture(page,{deferred:true});await expect(prompt(page)).toBeVisible({timeout:10000});expect(f.calls).toHaveLength(0);await expect(prompt(page).getByRole('button',{name:'Join Rivo',exact:true})).toBeEnabled();
});
test('the startup question cannot cover an active software installation',async({page})=>{
 const f=await fixture(page,{updating:true});await page.locator('.startup-screen').waitFor({state:'hidden'});await expect(page.locator('.update-overlay')).toBeVisible();await expect(prompt(page)).toHaveCount(0);expect(f.calls).toHaveLength(0);
});
