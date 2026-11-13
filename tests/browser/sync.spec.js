import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {chooseSettingsSection} from './settings-helpers.js';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800}});
const settings=async(page,name)=>chooseSettingsSection(page,name,{open:true});
test.beforeEach(async({page})=>{
 const token=(await(await page.request.get('/api/updates')).json()).controlToken;
 await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':token},data:{kind:'preferences',confirmed:true}});
 await page.request.post('/api/scenario',{data:{name:'Playback'}});
 await page.request.post('/api/event',{data:{type:'pause'}});
 await page.request.post('/api/event',{data:{type:'seek',position:0}});
 await page.goto(url);
});
test('shared timing saves, cancels and persists; per-video timing cannot change another track',async({page})=>{
 await settings(page,'Audio');await page.getByRole('slider',{name:'Screen delay',exact:true}).fill('250');await page.getByRole('slider',{name:'Visualizer fine adjustment',exact:true}).fill('-50');
 await expect(page.locator('.timing-result')).toContainText('Video: 250 ms · meters: 200 ms');await page.getByRole('button',{name:'Save',exact:true}).click();
 const screenSlider=await page.getByRole('slider',{name:'Screen delay',exact:true}).boundingBox(),meterSlider=await page.getByRole('slider',{name:'Visualizer fine adjustment',exact:true}).boundingBox();expect(Math.abs(screenSlider.y-meterSlider.y)).toBeLessThan(2);expect(meterSlider.x).toBeGreaterThan(screenSlider.x+screenSlider.width);
 await page.locator('.timing-controls').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/touch-timing-settings.png'});
 const saved=(await(await page.request.get('/api/preferences')).json()).prefs.timing;expect(saved).toEqual({screenDelayMs:250,visualizerTrimMs:-50});
 await page.getByRole('slider',{name:'Screen delay',exact:true}).fill('700');await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('slider',{name:'Screen delay',exact:true})).toHaveValue('250');
 await chooseSettingsSection(page,'Video');await page.getByLabel('Choose video',{exact:true}).setInputFiles({name:'sync.webm',mimeType:'video/webm',buffer:readFileSync('public/media/startup.webm')});
 const correction=page.getByLabel('Video start correction',{exact:true});await expect(correction).toBeVisible();await correction.fill('1.2');await expect(page.getByRole('button',{name:'Save',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Save',exact:true}).click();
 const link=await(await page.request.get('/api/video')).json();expect(link.sync).toEqual({mode:'starts',offsetSeconds:1.2});
 await correction.fill('2');await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(correction).toHaveValue('1.2');
 await page.reload();await settings(page,'Audio');await expect(page.getByRole('slider',{name:'Screen delay',exact:true})).toHaveValue('250');
 const token=(await(await page.request.get('/api/updates')).json()).controlToken;
 await page.request.post('/api/event',{data:{type:'next'}});
 const r=await page.request.post('/api/video/timing',{headers:{'X-TuneBox-Control':token},data:{trackKey:link.trackKey,id:link.id,revision:link.revision,sync:{mode:'starts',offsetSeconds:3}}});expect(r.status()).toBe(409);
 const pinned={'X-TuneBox-Control':token,'X-TuneBox-Track':link.trackKey,'X-TuneBox-Video':link.id};
 expect((await page.request.delete('/api/video',{headers:pinned})).status()).toBe(409);
 expect((await page.request.post('/api/video/upload',{headers:{...pinned,'Content-Type':'video/webm'},data:readFileSync('public/media/startup.webm')})).status()).toBe(409);
 await page.request.post('/api/event',{data:{type:'previous'}});expect((await(await page.request.get('/api/video')).json()).sync.offsetSeconds).toBe(1.2);
});
test('visualizer presents buffered PCM at the chosen delay and clears immediately on pause or stale input',async({page})=>{
 let stamp=0,status='pcm';
 await page.addInitScript(()=>{
  window.pcmArrivals={};window.pcmPresentations=[];
  const fetchOriginal=window.fetch;
  window.fetch=async(...args)=>{const r=await fetchOriginal(...args);if(String(args[0]).includes('/api/audio?watch=1'))r.clone().json().then(v=>{if(v.measurement)window.pcmArrivals[v.measurement.capturedAt]=performance.now();});return r;};
  new MutationObserver(records=>{for(const r of records){const stamp=r.target.dataset.capturedAt;if(stamp&&window.pcmArrivals[stamp]!==undefined)window.pcmPresentations.push(performance.now()-window.pcmArrivals[stamp]);}}).observe(document,{subtree:true,attributes:true,attributeFilter:['data-captured-at']});
 });
 await page.route('**/api/audio?watch=1',r=>r.fulfill({json:{enabled:true,configured:true,playerId:'local',matchesSelected:true,status,measurement:status==='pcm'?{capturedAt:++stamp,sampleRate:44100,channels:[{rmsDb:-12,peakDb:-6},{rmsDb:-18,peakDb:-9}],bandsDb:Array(32).fill(-18)}:null}}));
 await page.reload();await page.request.post('/api/event',{data:{type:'play'}});
 await settings(page,'Audio');await page.getByRole('slider',{name:'Screen delay',exact:true}).fill('500');await page.getByRole('slider',{name:'Visualizer fine adjustment',exact:true}).fill('100');
 const plot=page.locator('.hub-audio .real-audio');await expect(plot).toHaveAttribute('data-delay-ms','600');
 await page.evaluate(()=>window.pcmPresentations=[]);await expect.poll(()=>page.evaluate(()=>window.pcmPresentations.filter(v=>v>=550).length)).toBeGreaterThanOrEqual(5);
 const delays=await page.evaluate(()=>window.pcmPresentations.slice(-5));expect(Math.min(...delays)).toBeGreaterThanOrEqual(550);expect(Math.max(...delays)).toBeLessThan(900);
 await page.request.post('/api/event',{data:{type:'pause'}});await expect(plot).toHaveAttribute('data-captured-at','');await expect(plot.getByLabel('Left RMS',{exact:true})).toContainText('−∞');
 await page.request.post('/api/event',{data:{type:'play'}});await expect.poll(()=>plot.getAttribute('data-captured-at')).not.toBe('');status='stale';await expect(plot).toHaveAttribute('data-captured-at','');await expect(plot).toContainText('PCM export is stale');
});
test('a video that fails decoding leaves music playing and shows an owned fallback',async({page})=>{
 const token=(await(await page.request.get('/api/updates')).json()).controlToken;
 const bytes=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.alloc(64)]);
 const r=await page.request.post('/api/video/upload',{headers:{'X-TuneBox-Control':token,'Content-Type':'video/mp4'},data:bytes});expect(r.ok()).toBe(true);
 await page.getByRole('navigation',{name:'Music navigation'}).getByRole('button',{name:'Now Playing',exact:true}).click();await page.getByRole('button',{name:'Video Artwork',exact:true}).click();await page.request.post('/api/event',{data:{type:'play'}});
 await expect(page.getByText('Video could not play',{exact:true})).toBeVisible();expect((await(await page.request.get('/api/state')).json()).playback.playing).toBe(true);
});


test('full screen survives track changes and never shows the previous track video on an unlinked song',async({page})=>{
 const token=(await(await page.request.get('/api/updates')).json()).controlToken;
 await page.request.post('/api/video/upload',{headers:{'X-TuneBox-Control':token,'Content-Type':'video/webm'},data:readFileSync('public/media/startup.webm')});
 await page.getByRole('button',{name:'Video Artwork',exact:true}).click();await expect(page.getByLabel('Linked music video',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Full screen video',exact:true}).click();const full=page.getByRole('dialog',{name:'Full screen video',exact:true});await expect(full).toBeVisible();
 await page.request.post('/api/event',{data:{type:'next'}});await expect(full).toBeVisible();await expect(full.getByText('No video linked to this track',{exact:true})).toBeVisible();await expect(full.locator('video')).toHaveCount(0);
 await page.request.post('/api/event',{data:{type:'previous'}});await expect(full.getByLabel('Linked music video',{exact:true})).toBeVisible();await expect(page.getByLabel('Linked music video',{exact:true})).toHaveCount(1);
 await full.getByRole('button',{name:'Back to music',exact:true}).click();await expect(page.getByRole('dialog',{name:'Full screen video',exact:true})).toHaveCount(0);await expect(page.getByLabel('Linked music video',{exact:true})).toBeVisible();
});
