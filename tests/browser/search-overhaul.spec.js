import {test,expect} from '@playwright/test';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800},reducedMotion:'reduce'});
const shot=async(page,name)=>{if(process.env.TUNEBOX_SHOTS)await page.screenshot({path:process.env.TUNEBOX_SHOTS+'/'+name+'.png'});};
test.beforeEach(async({page})=>{const t=(await(await page.request.get('/api/updates')).json()).controlToken,headers={'X-TuneBox-Control':t};await page.request.post('/api/reset',{headers,data:{kind:'preferences',confirmed:true}});const saved=await(await page.request.get('/api/preferences')).json();await page.request.post('/api/preferences',{headers,data:{revision:saved.revision,patch:{prefs:{...saved.prefs,startupAnimation:'off'}}}});});
async function live(page){const state=await(await page.request.get('/api/state')).json();Object.assign(state,{mode:'music-assistant',musicAssistant:{connected:true,playerId:'pi',controlEnabled:true,volumeLimit:40}});state.playback={...state.playback,connected:true,playerId:'pi',playing:false,volume:20,capabilities:['volume_set'],queue:[{id:'t',title:'Local music',artist:'Artist',album:'Album',duration:240}],index:0};await page.route('**/api/events',r=>r.abort());await page.route('**/api/state',r=>r.fulfill({json:state}));return state;}
const items=[{id:'a',type:'track',name:'Bohemian Rhapsody – Remastered 2011',artist:'Queen',album:'A Night at the Opera',available:true},{id:'b',type:'album',name:'Bohemian Rhapsody (The Original Soundtrack)',artist:'Queen',available:true},{id:'c',type:'artist',name:'Queen',available:true},{id:'d',type:'track',name:'Bohemian Like You',artist:'The Dandy Warhols',available:true},{id:'e',type:'playlist',name:'Bohemian Classics',artist:'',available:true}];
test('search suggestions are readable above a compact keyboard',async({page})=>{
 await live(page);await page.route('**/api/library?*',r=>r.fulfill({json:{items,hasMore:false}}));
 await page.goto(url);await page.locator('.m2-header').getByRole('button',{name:'Search',exact:true}).click();
 const keyboard=page.getByRole('dialog',{name:'Touch keyboard',exact:true});await keyboard.getByLabel('Keyboard entry',{exact:true}).fill('bohem');
 const suggestions=keyboard.getByRole('region',{name:'Music suggestions',exact:true});await expect(suggestions.getByRole('button').first()).toBeVisible();
 await shot(page,'search-after');
 const list=await suggestions.getByRole('button').all();expect(list.length).toBeGreaterThanOrEqual(4);
 for(const b of list){const box=await b.boundingBox();expect(box.height).toBeGreaterThanOrEqual(56);const size=await b.locator('strong').evaluate(e=>parseFloat(getComputedStyle(e).fontSize));expect(size).toBeGreaterThanOrEqual(20);
  expect(await b.locator('strong').evaluate(e=>e.scrollWidth<=e.clientWidth+1||getComputedStyle(e).textOverflow==='ellipsis')).toBe(true);}
 // Suggestions and keys both fit on screen, keys still large enough to hit.
 const keys=keyboard.locator('.keyboard-keys');const kb=await keys.boundingBox(),sb=await suggestions.boundingBox();expect(sb.y+sb.height).toBeLessThanOrEqual(kb.y+1);expect(kb.y+kb.height).toBeLessThanOrEqual(800);
 const key=await keyboard.getByRole('button',{name:'Key q'}).boundingBox();expect(key.height).toBeGreaterThanOrEqual(56);expect(key.width).toBeGreaterThanOrEqual(56);
 await expect(suggestions.getByText('Queen').first()).toBeVisible();await expect(suggestions.getByText('Album',{exact:false}).first()).toBeVisible();
});
