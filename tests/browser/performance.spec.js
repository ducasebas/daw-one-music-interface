import {test,expect} from '@playwright/test';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800}});
test.beforeEach(async({page})=>{
 const token=(await(await page.request.get('/api/updates')).json()).controlToken;
 const response=await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':token},data:{kind:'preferences',confirmed:true}});
 expect(response.ok()).toBe(true);
});

test('paused wall avoids global clock renders and duplicate state/update requests',async({page})=>{
 const updates=await(await page.request.get('/api/updates')).json();
 await page.route('**/api/updates',route=>route.fulfill({json:{...updates,status:'up-to-date',manager:{...updates.manager,managed:true,simulated:false,configured:true,setupComplete:true,progressDisplay:true}}}));
 await page.request.post('/api/scenario',{data:{name:'Playback'}});await page.request.post('/api/event',{data:{type:'pause'}});
 await page.addInitScript(()=>{
  let last=null;window.__shellRenders=0;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__={supportsFiber:true,renderers:new Map(),checkDCE(){},inject(value){this.renderers.set(1,value);return 1;},onCommitFiberUnmount(){},onCommitFiberRoot(_id,root){
   const walk=f=>{if(!f)return;if(typeof f.type==='string'&&f.memoizedProps?.className?.split(' ').includes('music2')){if(last!==f.memoizedProps){last=f.memoizedProps;window.__shellRenders++;}return;}walk(f.child);walk(f.sibling);};walk(root.current);
  }};
 });
 let states=0,checks=0;page.on('request',request=>{const path=new URL(request.url()).pathname;if(path==='/api/state')states++;if(path==='/api/updates')checks++;});
 await page.goto(url);await expect(page.locator('.music2')).toBeVisible();await expect(page.getByRole('status',{name:'Startup animation',exact:true})).toHaveCount(0,{timeout:10000});
 await expect.poll(()=>page.evaluate(()=>window.__shellRenders)).toBeGreaterThan(0);
 const before=await page.evaluate(()=>window.__shellRenders),initialStates=states,initialChecks=checks;
 await page.waitForTimeout(6200);
 expect(states-initialStates).toBe(0);expect(checks-initialChecks).toBeLessThanOrEqual(3);
 expect(await page.evaluate(()=>window.__shellRenders)-before).toBeLessThanOrEqual(5);
});

test('progress keeps advancing locally while the live stream is healthy and seeking still commits',async({page})=>{
 await page.request.post('/api/scenario',{data:{name:'Playback'}});await page.goto(url);
 const progress=page.getByRole('slider',{name:'Playback position',exact:true});await expect(progress).toBeVisible();
 await expect(page.getByRole('status',{name:'Startup animation',exact:true})).toHaveCount(0,{timeout:10000});
 const before=await progress.inputValue();await expect.poll(()=>progress.inputValue(),{timeout:2500}).not.toBe(before);
 await progress.focus();await page.keyboard.press('Home');
 await expect.poll(async()=>{const s=await(await page.request.get('/api/state')).json();return s.playback.position;}).toBeLessThan(3);
});

test('state fallback stays usable when EventSource is unavailable',async({page})=>{
 await page.request.post('/api/scenario',{data:{name:'Playback'}});
 await page.route('**/api/events',route=>route.abort());await page.goto(url);
 await expect(page.locator('.music2')).toBeVisible();
 await page.request.post('/api/event',{data:{type:'pause'}});
 await expect(page.locator('.m2-transport').getByRole('button',{name:'Play',exact:true})).toBeVisible({timeout:5000});
 await page.request.post('/api/event',{data:{type:'play'}});
 await expect(page.locator('.m2-transport').getByRole('button',{name:'Pause',exact:true})).toBeVisible({timeout:5000});
});

test('paused local meters release analysis while another room cannot pause local PCM',async({page})=>{
 let matchesSelected=true,watches=0;
 await page.route('**/api/audio*',route=>{
  if(new URL(route.request().url()).searchParams.has('watch'))watches++;
  return route.fulfill({json:{enabled:true,configured:true,matchesSelected,status:'idle',measurement:null}});
 });
 await page.request.post('/api/scenario',{data:{name:'Playback'}});await page.request.post('/api/event',{data:{type:'pause'}});await page.goto(url);
 await expect(page.getByRole('status',{name:'Startup animation',exact:true})).toHaveCount(0,{timeout:10000});
 await page.getByRole('button',{name:'Switch visualizer',exact:true}).click();await expect(page.locator('.audio-spectrum')).toBeVisible();
 await page.waitForTimeout(400);const pausedWatches=watches;await page.waitForTimeout(4300);expect(watches).toBe(pausedWatches);
 await page.request.post('/api/event',{data:{type:'play'}});await expect(page.locator('.m2-transport').getByRole('button',{name:'Pause',exact:true})).toBeVisible();await expect.poll(()=>watches,{timeout:1500}).toBeGreaterThan(pausedWatches+2);
 matchesSelected=false;await page.request.post('/api/event',{data:{type:'pause'}});await page.waitForTimeout(300);const remoteWatches=watches;
 await expect.poll(()=>watches,{timeout:1500}).toBeGreaterThan(remoteWatches+2);
});

test('a physical wake returns from screen rest to Now Playing and is consumed once',async({page})=>{
 await page.addInitScript(()=>{const Native=window.EventSource;window.EventSource=class extends Native{constructor(...args){super(...args);window.__testStateStream=this;}};});
 await page.request.post('/api/scenario',{data:{name:'Playback'}});await page.goto(url);
 await expect(page.getByRole('status',{name:'Startup animation',exact:true})).toHaveCount(0,{timeout:10000});
 await page.locator('.m2-header nav').getByRole('button',{name:'Queue',exact:true}).click();
 await page.getByRole('button',{name:'Screen rest',exact:true}).click();await expect(page.locator('.sleep-surface')).toBeVisible();
 await page.request.post('/api/activity');await expect(page.locator('.sleep-surface')).toHaveCount(0);
 const state=await(await page.request.get('/api/state')).json();state.navigation={buttonWakeId:'test-physical-wake'};
 // The real backend retains its wake id in every later snapshot. Keep this
 // injected event coherent with HTTP fallback and stop contradictory live
 // simulator frames from erasing it before React commits the wake effect.
 await page.route('**/api/state',route=>route.fulfill({json:state}));
 await page.evaluate(()=>window.__testStateStream.close());
 const deliver=()=>page.evaluate(state=>window.__testStateStream.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(state)})),state);
 await deliver();await expect(page.locator('.music2')).toHaveAttribute('data-page','playing');
 await page.locator('.m2-header nav').getByRole('button',{name:'Rooms',exact:true}).click();await deliver();await expect(page.locator('.music2')).toHaveAttribute('data-page','rooms');
});
