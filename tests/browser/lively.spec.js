import {test,expect,devices} from '@playwright/test';
import {chooseSettingsSection} from './settings-helpers.js';
import {remoteView} from '../../server/remote-control.js';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800},reducedMotion:'no-preference'});
const art=c=>'/api/artwork/'+c.repeat(64);
const svg=color=>`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${color}"/></svg>`;
async function token(page){return (await(await page.request.get('/api/updates')).json()).controlToken;}
async function prefs(page,patch={}){const headers={'X-TuneBox-Control':await token(page)};const p=await(await page.request.get('/api/preferences')).json();await page.request.post('/api/preferences',{headers,data:{revision:p.revision,patch:{setupCompleted:true,prefs:{...p.prefs,startupAnimation:'off',...patch}}}});}
async function live(page){
 const state=await(await page.request.get('/api/state')).json();
 Object.assign(state,{mode:'music-assistant',musicAssistant:{connected:true,status:'connected',playerId:'pi',controlEnabled:true,volumeLimit:40,players:[{id:'pi',name:'Living room',available:true},{id:'k',name:'Kitchen',available:true}]}});
 state.playback={...state.playback,connected:true,playerId:'pi',playerName:'Living room',playing:false,position:10,observedAt:Date.now(),volume:20,capabilities:['volume_set','volume_mute','seek'],sourceFormat:{codec:'flac',sampleRate:44100,bitDepth:16},
  queue:[{id:'t1',title:'First',artist:'A',album:'X',duration:200,artwork:art('a')},{id:'t2',title:'Second',artist:'B',album:'Y',duration:180,artwork:art('b')}],index:0};
 // Serve the live preferences: a frozen copy made before Save made a later state poll undo the saved widgets (intermittent).
 await page.route('**/api/events',r=>r.abort());await page.route('**/api/state',async r=>{const real=await(await page.request.get('/api/state')).json();return r.fulfill({json:{...state,preferences:real.preferences}});});
 await page.route('**/api/artwork/**',r=>r.fulfill({contentType:'image/svg+xml',body:svg(r.request().url().endsWith('a')?'#c33':'#33c')}));
 return state;
}
test.beforeEach(async({page})=>{await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':await token(page)},data:{kind:'preferences',confirmed:true}});await prefs(page);});
test.afterAll(async({request})=>{const t=(await(await request.get('/api/updates')).json()).controlToken;await request.post('/api/reset',{headers:{'X-TuneBox-Control':t},data:{kind:'preferences',confirmed:true}});});

test('Now Playing shows the blurred artwork backdrop and cross-fades to the next cover',async({page})=>{
 const state=await live(page);await page.goto(url);await page.getByRole('button',{name:'Now Playing',exact:true}).first().click();
 const backdrop=page.locator('.np-backdrop');await expect(backdrop).toHaveAttribute('data-mode','live');await expect(backdrop).toHaveAttribute('data-artwork','true');
 const layer=backdrop.locator('.np-backdrop-layer[data-current=true]');await expect(layer).toHaveAttribute('style',new RegExp(art('a').replace(/\//g,'\\/')));
 expect(await layer.evaluate(e=>getComputedStyle(e).filter)).toMatch(/blur/);
 state.playback={...state.playback,index:1};await page.reload();await page.getByRole('button',{name:'Now Playing',exact:true}).first().click();
 await expect(backdrop.locator('.np-backdrop-layer[data-current=true]')).toHaveAttribute('style',new RegExp('b{64}'));
 await expect(backdrop.locator('.np-backdrop-layer')).toHaveCount(1,{timeout:3000});
 await page.screenshot({path:'test-results/lively-backdrop.png'});
});
test('Pi 3 mode and the off switch never load or blur artwork behind Now Playing',async({page})=>{
 await live(page);await page.goto(url+'&profile=pi3');await page.getByRole('button',{name:'Now Playing',exact:true}).first().click();
 await expect(page.locator('.np-backdrop')).toHaveAttribute('data-mode','static');await expect(page.locator('.np-backdrop-layer')).toHaveCount(0);
 await prefs(page,{backdrop:'off'});await page.unrouteAll({behavior:'ignoreErrors'});await live(page);await page.goto(url);await page.getByRole('button',{name:'Now Playing',exact:true}).first().click();
 await expect(page.locator('.np-backdrop')).toHaveCount(0);
});
test('widgets are chosen in Display (max 4), show real values, say Not available honestly and open their screen',async({page})=>{
 await live(page);await page.goto(url);await page.getByRole('button',{name:'Now Playing',exact:true}).first().click();
 const widgets=page.getByRole('region',{name:'Now Playing widgets',exact:true});
 await expect(widgets.locator('.np-widget')).toHaveCount(3);
 await expect(widgets.locator('[data-widget=upnext]')).toContainText('Second');await expect(widgets.locator('[data-widget=source]')).toContainText('FLAC · 44.1 kHz · 16-bit');
 await chooseSettingsSection(page,'Display',{open:true});
 const group=page.getByRole('group',{name:'Now Playing',exact:true});
 await group.getByLabel('Power',{exact:true}).check();await expect(group.getByLabel('Rooms',{exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('[data-saved=true]')).toBeVisible();
 await page.getByRole('button',{name:'Open Now Playing',exact:true}).click();
 await expect(widgets.locator('.np-widget')).toHaveCount(4);
 const power=widgets.locator('[data-widget=power]');await expect(power).toHaveAttribute('data-available','false');await expect(power).toContainText('Not available');
 for(const tile of await widgets.locator('.np-widget').all()){const b=await tile.boundingBox();expect(b.height).toBeGreaterThanOrEqual(80);expect(b.y+b.height).toBeLessThanOrEqual(640);}
 await page.screenshot({path:'test-results/lively-widgets.png'});
 await widgets.locator('[data-widget=upnext]').click();await expect(page.locator('.music2')).toHaveAttribute('data-page','queue');
});
test('the phone remote follows the TuneBox skin and shows what plays next and the source quality',async({browser})=>{
 const ctx=await browser.newContext({...devices['iPhone 13'],browserName:undefined,defaultBrowserType:undefined,baseURL:'http://127.0.0.1:5173'});const page=await ctx.newPage();
 const view=remoteView({mode:'music-assistant',musicAssistant:{status:'connected',volumeLimit:40},preferences:{themePreferences:{selected:'warm-bronze',mode:'manual'}},
  playback:{connected:true,playing:false,position:30,duration:200,volume:20,index:0,sourceFormat:{codec:'flac',sampleRate:96000,bitDepth:24},queue:[{title:'Now',artist:'A',duration:200,artwork:art('a')},{title:'Second',artist:'B'}]}});
 await page.route('**/api/remote/session',r=>r.fulfill({json:{paired:true}}));
 await page.route('**/api/remote/events',r=>r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify(view)+'\n\n'}));
 await page.route('**/api/artwork/**',r=>r.fulfill({contentType:'image/svg+xml',body:svg('#c33')}));
 await page.goto('/remote.html');
 await expect(page.getByRole('region',{name:'Up next',exact:true})).toContainText('Second');await expect(page.locator('.remote-quality')).toHaveText('FLAC · 96 kHz · 24-bit');
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--remote-accent').trim())).toBe('#c58b5c');
 expect(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor)).toBe('rgb(27, 21, 18)');
 await expect(page.locator('.remote-backdrop>div')).toHaveCount(1);await expect(page.locator('.remote-progress')).toBeVisible();
 await page.screenshot({path:'test-results/lively-remote.png'});await ctx.close();
});
test('Inter is the interface font everywhere, Manrope Heavy is one tap away, and Settings shares the artwork backdrop',async({page})=>{
 await live(page);await page.goto(url);
 const family=sel=>page.locator(sel).first().evaluate(e=>getComputedStyle(e).fontFamily.split(',')[0].replace(/"/g,'').trim());
 await expect(page.locator('html')).toHaveAttribute('data-font','inter');
 await page.getByRole('button',{name:'Now Playing',exact:true}).first().click();expect(await family('.m2-playing h2')).toBe('Inter Variable');
 await page.locator('.m2-header').getByRole('button',{name:'Settings',exact:true}).click();
 await expect(page.locator('.np-backdrop')).toHaveAttribute('data-artwork','true');expect(await family('.hub-heading h2')).toBe('Inter Variable');
 expect(await page.evaluate(()=>document.fonts.check('600 20px "Inter Variable"'))).toBe(true);
 await chooseSettingsSection(page,'Connections');await page.locator('.setup-cards button').filter({hasText:'Music Assistant'}).first().click();
 const wizard=page.getByRole('dialog',{name:'Music Assistant setup',exact:true});expect(await family('.first-start h2')).toBe('Inter Variable');
 await wizard.getByLabel('Music Assistant server address',{exact:true}).click();
 const keyboard=page.getByRole('dialog',{name:'Touch keyboard',exact:true});await expect(keyboard).toBeVisible();
 expect(await keyboard.locator('.keyboard-keys button').first().evaluate(e=>[getComputedStyle(e).fontFamily.split(',')[0].replace(/"/g,''),parseFloat(getComputedStyle(e).fontSize)])).toEqual(['Inter Variable',26]);
 await keyboard.getByRole('button',{name:'Done typing',exact:true}).click();await wizard.getByRole('button',{name:'Finish later',exact:true}).click();
 await chooseSettingsSection(page,'Appearance');const fonts=page.getByRole('radiogroup',{name:'Interface font',exact:true});
 await expect(fonts.getByRole('radio',{name:/^Inter/})).toHaveAttribute('aria-checked','true');
 await fonts.getByRole('radio',{name:/^Manrope Heavy/}).click();await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('[data-saved=true]')).toBeVisible();
 expect((await(await page.request.get('/api/preferences')).json()).prefs.font).toBe('manrope-heavy');
});
test('the phone remote also asks before replacing a queue with music waiting',async({browser})=>{
 const ctx=await browser.newContext({...devices['iPhone 13'],browserName:undefined,defaultBrowserType:undefined,baseURL:'http://127.0.0.1:5173'});const page=await ctx.newPage();
 const view=remoteView({mode:'music-assistant',musicAssistant:{status:'connected',volumeLimit:40},preferences:{},playback:{connected:true,volume:20,index:0,queue:[{title:'Now'},{title:'Theirs'}]}});
 const plays=[];
 await page.route('**/api/remote/session',r=>r.fulfill({json:{paired:true}}));
 await page.route('**/api/remote/events',r=>r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify(view)+'\n\n'}));
 await page.route('**/api/remote/search*',r=>r.fulfill({json:{items:[{id:'t1',type:'track',name:'Mine',artist:'Me',available:true}],hasMore:false}}));
 await page.route('**/api/remote/play',r=>{const b=r.request().postDataJSON();plays.push(b);if(b.option==='replace'&&!b.confirmReplace)return r.fulfill({status:409,json:{error:'waiting',code:'queue-not-empty',upcoming:1}});return r.fulfill({json:view});});
 await page.goto('/remote.html');await page.getByRole('searchbox',{name:'Search music'}).fill('mine');await page.getByRole('button',{name:'Search',exact:true}).click();
 await page.getByRole('button',{name:'Play now',exact:true}).click();
 const sheet=page.getByRole('dialog',{name:'Music is waiting in the queue',exact:true});await expect(sheet).toContainText('1 track is queued');
 await sheet.getByRole('button',{name:'Add to the end',exact:true}).click();await expect(sheet).toHaveCount(0);
 expect(plays.map(p=>p.option+(p.confirmReplace?'!':''))).toEqual(['replace','add']);
 await expect(page.locator('.remote-error')).toHaveCount(0);await ctx.close();
});
