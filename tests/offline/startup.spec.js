import {test,expect} from '@playwright/test';
test.use({viewport:{width:1280,height:800}});
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
async function prepare(page){
 const token=(await(await page.request.get('/api/updates')).json()).controlToken;
 await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':token},data:{kind:'preferences',confirmed:true}});
 await page.request.post('/api/scenario',{data:{name:'Playback'}});
 await page.goto(url);await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
}
test('production worker passes video byte ranges through and a real video decodes after reload',async({page})=>{
 await prepare(page);await page.reload();
 for(const format of ['mp4','webm']){
  const range=await page.evaluate(async format=>{try{const r=await fetch('/media/startup.'+format,{headers:{Range:'bytes=0-127'}});return {status:r.status,range:r.headers.get('content-range'),bytes:(await r.arrayBuffer()).byteLength};}catch(e){return {error:e.message};}},format);
  expect(range).toMatchObject({status:206,bytes:128});expect(range.range).toMatch(/^bytes 0-127\/\d+$/);
 }
 const video=await page.evaluate(async()=>{
  const v=document.createElement('video');v.muted=true;v.playsInline=true;document.body.append(v);
  try{
   await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Decoder deadline')),8000);v.onloadeddata=()=>{clearTimeout(timer);resolve();};v.onerror=()=>{clearTimeout(timer);reject(Error('Media error '+v.error?.code));};v.src='/media/startup.webm';});
   await v.play();await new Promise(resolve=>setTimeout(resolve,650));
   return {time:v.currentTime,width:v.videoWidth,frames:v.getVideoPlaybackQuality().totalVideoFrames};
  }finally{v.remove();}
 });
 expect(video.width).toBe(1280);expect(video.time).toBeGreaterThan(.3);expect(video.frames).toBeGreaterThan(1);
});
test('WebP is the moving default, replays from a fresh image and remains animated offline',async({page,context})=>{
 await prepare(page);await page.reload();
 const splash=page.getByRole('status',{name:'Startup animation',exact:true}),image=splash.locator('.startup-frame-animation');
 await expect(splash).toHaveAttribute('data-renderer','image-animation');await expect(splash.locator('video')).toHaveCount(0);
 await expect(image).toHaveJSProperty('naturalWidth',1280);await expect(image).toHaveJSProperty('naturalHeight',800);
 const source=await image.getAttribute('src'),first=await image.screenshot();
 await page.waitForTimeout(800);expect((await image.screenshot()).equals(first)).toBe(false);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('tunebox-startup-status')).time)).toBeGreaterThan(.5);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('tunebox-startup-status')).frames)).toBeNull();
 await expect(splash).not.toBeVisible({timeout:6000});
 await context.setOffline(true);await page.reload();
 await expect(splash).toHaveAttribute('data-renderer','image-animation');expect(await image.getAttribute('src')).not.toBe(source);
 const replay=await image.screenshot();await page.waitForTimeout(800);expect((await image.screenshot()).equals(replay)).toBe(false);
 const copies=await page.evaluate(async()=>{const key=(await caches.keys()).find(k=>k.startsWith('daw-one-shell-v'));if(!key)throw Error('No active shell cache');const cache=await caches.open(key);return (await cache.keys()).map(r=>new URL(r.url)).filter(u=>u.pathname==='/media/startup.webp').map(u=>u.search);});
 expect(copies).toEqual(['']);
});
