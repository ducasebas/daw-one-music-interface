import {test,expect} from '@playwright/test';
test.use({viewport:{width:1280,height:800}});
test('unresponsive branding media cannot keep a ready music interface blocked',async({page})=>{
 const token=(await(await page.request.get('/api/updates')).json()).controlToken;
 const saved=await(await page.request.get('/api/preferences')).json();
 await page.request.post('/api/preferences',{headers:{'X-TuneBox-Control':token},data:{revision:saved.revision,patch:{prefs:{...saved.prefs,startupAnimation:'video'}}}});
 await page.request.post('/api/scenario',{data:{name:'Playback'}});
 const before=await(await page.request.get('/api/state')).json();
 let release;const gate=new Promise(resolve=>release=resolve);
 const hold=async route=>{await gate;await route.abort().catch(()=>{});};
 await page.route('**/media/startup.webp*',hold);await page.route('**/media/startup.mp4',hold);await page.route('**/media/startup.webm',hold);
 try{
  await page.goto('/?gui=2&screen=1&display=dsi-production&panel=wall-16-10',{waitUntil:'domcontentloaded'});
  const splash=page.getByRole('status',{name:'Startup animation',exact:true});await expect(splash).toBeVisible();
  await expect(splash).toHaveCount(0,{timeout:11000});
  await page.locator('.m2-header nav').getByRole('button',{name:'Queue',exact:true}).click();await expect(page.locator('.music2')).toHaveAttribute('data-page','queue');
  const after=await(await page.request.get('/api/state')).json();expect(after.device.amplifierEnabled).toBe(before.device.amplifierEnabled);expect(after.playback.playing).toBe(before.playback.playing);
 }finally{release();}
});
