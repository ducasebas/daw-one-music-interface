import {test,expect} from '@playwright/test';
import {chooseSettingsSection} from './settings-helpers.js';
const wall='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800}});
async function prepare(page,patch={}){
 const token=(await(await page.request.get('/api/updates')).json()).controlToken;
 await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':token},data:{kind:'preferences',confirmed:true}});
 const settings=await(await page.request.get('/api/preferences')).json();
 await page.request.post('/api/preferences',{headers:{'X-TuneBox-Control':token},data:{revision:settings.revision,patch:{setupCompleted:true,prefs:{...settings.prefs,startupAnimation:'off',headerAutoHide:true,visualizer:'spectrum',widgets:['clock','upnext','source'],...patch}}}});
 await page.request.post('/api/scenario',{data:{name:'Playback'}});
 await page.route('**/api/audio*',route=>route.fulfill({json:{enabled:true,configured:true,matchesSelected:true,status:'pcm',measurement:{capturedAt:Date.now(),sampleRate:44100,channels:[{rmsDb:-18,peakDb:-9},{rmsDb:-18,peakDb:-9}],bandsDb:Array(32).fill(-36)}}}));
}
const geometry=page=>page.locator('.m2-playing').evaluate(node=>Object.fromEntries(['.m2-track','aside','.real-audio','.audio-spectrum','.np-widgets'].map(selector=>{const r=node.querySelector(selector)?.getBoundingClientRect();return [selector,r?{x:r.x,y:r.y,width:r.width,height:r.height}:null];})));
test('the wall header spans the screen and hiding it never moves the track, meters or widgets',async({page})=>{
 await prepare(page);await page.goto(wall);
 const shell=page.locator('.music2'),header=page.locator('.m2-header');await expect(shell).toHaveAttribute('data-header','shown');
 const frame=await shell.boundingBox(),bar=await header.boundingBox();expect(Math.abs(bar.x-frame.x)).toBeLessThanOrEqual(1);expect(Math.abs(bar.width-frame.width)).toBeLessThanOrEqual(2);
 await expect(page.locator('.audio-spectrum')).toBeVisible();const shown=await geometry(page);await page.getByRole('button',{name:'Hide menu',exact:true}).click();await expect(shell).toHaveAttribute('data-header','hidden');await page.waitForTimeout(350);expect(await geometry(page)).toEqual(shown);
 await page.getByRole('button',{name:'Show menu',exact:true}).click();await expect(shell).toHaveAttribute('data-header','shown');await page.waitForTimeout(350);expect(await geometry(page)).toEqual(shown);
 for(const name of ['Queue','Discover']){await page.locator('.m2-header nav').getByRole('button',{name,exact:true}).click();const bar=await header.boundingBox();expect(Math.abs(bar.x-frame.x)).toBeLessThanOrEqual(1);expect(Math.abs(bar.width-frame.width)).toBeLessThanOrEqual(2);}
});
for(const headerAutoHide of [true,false])test(`the Now Playing layout does not change when startup becomes ready (auto hide: ${headerAutoHide})`,async({page})=>{
 await prepare(page,{startupAnimation:'still',headerAutoHide});await page.goto(wall);
 const splash=page.getByRole('status',{name:'Startup animation',exact:true});await expect(splash).toBeVisible();
 const before=await geometry(page);delete before['.audio-spectrum'];await splash.click();await expect(splash).toHaveCount(0);await expect(page.locator('.music2')).toHaveAttribute('data-header-mode',headerAutoHide?'auto':'fixed');const after=await geometry(page);delete after['.audio-spectrum'];expect(after).toEqual(before);
});
test('widget selection is an owned popup with cancel, staged Apply and a scrollable touch surface',async({page})=>{
 await prepare(page);await page.goto(wall);await chooseSettingsSection(page,'Display',{open:true});
 await expect(page.locator('.widget-editor')).toHaveCount(0);
 const choose=page.getByRole('button',{name:'Choose widgets: Now Playing widgets',exact:true});await choose.click();
 let popup=page.getByRole('dialog',{name:'Now Playing widgets',exact:true});await expect(popup).toBeVisible();
 await popup.getByRole('button',{name:'Add Power',exact:true}).click();await popup.getByRole('button',{name:'Cancel',exact:true}).click();await expect(popup).toHaveCount(0);await expect(page.locator('.hub-savebar')).toHaveCount(0);
 await choose.click();popup=page.getByRole('dialog',{name:'Now Playing widgets',exact:true});await expect(popup.locator('.we-slots>li').nth(3)).toHaveAttribute('data-empty','true');
 await popup.getByRole('button',{name:'Add Wi-Fi',exact:true}).click();await popup.getByRole('button',{name:'Apply selection',exact:true}).click();await expect(popup).toHaveCount(0);await expect(page.getByRole('button',{name:'Save',exact:true})).toBeEnabled();
 expect((await(await page.request.get('/api/preferences')).json()).prefs.widgets).toEqual(['clock','upnext','source']);
 await page.getByRole('button',{name:'Save',exact:true}).click();await expect.poll(async()=>(await(await page.request.get('/api/preferences')).json()).prefs.widgets).toEqual(['clock','upnext','source','wifi']);
 await page.setViewportSize({width:1280,height:400});await choose.click();popup=page.getByRole('dialog',{name:'Now Playing widgets',exact:true});
 const body=popup.locator('.tb-sheet-body');expect(await body.evaluate(n=>getComputedStyle(n).touchAction)).toBe('pan-y');expect(await popup.locator('.widget-editor').evaluate(n=>getComputedStyle(n).touchAction)).toBe('pan-y');
 await body.evaluate(n=>n.scrollTop=0);const box=await body.boundingBox();await page.mouse.move(box.x+box.width-40,box.y+50);await page.mouse.wheel(0,450);await expect.poll(()=>body.evaluate(n=>n.scrollTop)).toBeGreaterThan(0);
 await expect(popup.getByRole('button',{name:'Apply selection',exact:true})).toBeInViewport();await popup.getByRole('button',{name:'Cancel',exact:true}).click();
});
test('a visible local visualizer uses one live feed, sparse lease renewals and stops on local pause or navigation',async({page})=>{
 await prepare(page);
 let renewals=0;
 await page.route('**/api/audio?watch=1',route=>{renewals++;return route.fulfill({json:{enabled:true,configured:true,matchesSelected:true,status:'starting',measurement:null,streamUrl:'/api/audio/events'}});});
 await page.addInitScript(()=>{
  window.__audioCommits=0;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__={supportsFiber:true,renderers:new Map(),checkDCE(){},inject(value){this.renderers.set(1,value);return 1;},onCommitFiberRoot(){window.__audioCommits++;},onCommitFiberUnmount(){}};
  const Native=window.EventSource;window.__audioSources=[];
  window.EventSource=class extends Native{
   constructor(url,...args){
    if(url==='/api/audio/events'){
     const source={closed:false,onmessage:null,onerror:null,close(){source.closed=true;clearInterval(timer);}};window.__audioSources.push(source);let count=0;
     const timer=setInterval(()=>{if(!source.onmessage||source.closed)return;count++;source.onmessage({data:JSON.stringify({enabled:true,configured:true,matchesSelected:true,status:'pcm',measurement:{capturedAt:Date.now(),sampleRate:44100,channels:[{rmsDb:-24,peakDb:-12},{rmsDb:-24,peakDb:-12}],bandsDb:Array.from({length:32},(_,i)=>window.__quietAudio?-96:-36+10*Math.sin(count/4+i/3))}})});},50);return source;
    }
    super(url,...args);
   }
  };
 });
 await page.goto(wall);const plot=page.locator('.m2-playing .real-audio');await expect(plot.locator('.audio-spectrum')).toBeVisible();const first=await plot.getAttribute('data-captured-at');await expect.poll(()=>plot.getAttribute('data-captured-at')).not.toBe(first);
 const before=await page.evaluate(()=>window.__audioCommits);await page.waitForTimeout(1800);expect(await page.evaluate(()=>window.__audioCommits)-before).toBeLessThanOrEqual(20);expect(renewals).toBeLessThanOrEqual(3);expect(await page.evaluate(()=>window.__audioSources.filter(s=>!s.closed).length)).toBe(1);
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.__quietAudio=true);await expect.poll(()=>plot.locator('.audio-band').evaluateAll(nodes=>nodes.every(n=>n.style.getPropertyValue('--level')==='0'))).toBe(true);
 await plot.locator('.audio-spectrum').evaluate(node=>{window.__quietStyleChanges=0;new MutationObserver(records=>window.__quietStyleChanges+=records.length).observe(node,{subtree:true,attributes:true,attributeFilter:['style']});});await page.waitForTimeout(550);expect(await page.evaluate(()=>window.__quietStyleChanges)).toBe(0);
 await page.request.post('/api/event',{data:{type:'pause'}});await expect(plot).toHaveAttribute('data-resting','true');await expect.poll(()=>page.evaluate(()=>window.__audioSources.filter(s=>!s.closed).length)).toBe(0);
 await page.request.post('/api/event',{data:{type:'play'}});await expect.poll(()=>page.evaluate(()=>window.__audioSources.filter(s=>!s.closed).length)).toBe(1);
 await page.getByRole('button',{name:'Show menu',exact:true}).count().then(async n=>{if(n)await page.getByRole('button',{name:'Show menu',exact:true}).click();});await page.locator('.m2-header nav').getByRole('button',{name:'Queue',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__audioSources.filter(s=>!s.closed).length)).toBe(0);
});
test('cold-start decoration and PCM demand wait for the first usable music screen',async({page})=>{
 await prepare(page,{startupAnimation:'still'});let watches=0;await page.route('**/api/audio*',route=>{if(new URL(route.request().url()).searchParams.has('watch'))watches++;return route.fulfill({json:{enabled:false,configured:false,status:'not-configured',measurement:null}});});
 await page.goto(wall);const splash=page.getByRole('status',{name:'Startup animation',exact:true});await expect(splash).toBeVisible();await page.waitForTimeout(250);expect(watches).toBe(0);await expect(page.locator('.np-backdrop-layer')).toHaveCount(0);
 await splash.click();await expect(splash).toHaveCount(0);await expect.poll(()=>watches).toBeGreaterThan(0);await page.locator('.m2-header nav').getByRole('button',{name:'Queue',exact:true}).click();await expect(page.locator('.music2')).toHaveAttribute('data-page','queue');
});
