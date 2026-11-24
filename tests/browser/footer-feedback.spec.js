import {test,expect} from '@playwright/test';

for(const wall of [false,true])test(`playback feedback stays on the pressed button without a separate footer loading ring (${wall?'wall':'wide'})`,async({page})=>{
 if(wall)await page.setViewportSize({width:1280,height:800});
 const token=(await(await page.request.get('/api/updates')).json()).controlToken;
 await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':token},data:{kind:'preferences',confirmed:true}});
 const prefs=(await(await page.request.get('/api/preferences')).json());
 await page.request.post('/api/preferences',{headers:{'X-TuneBox-Control':token},data:{revision:prefs.revision,patch:{setupCompleted:true,prefs:{...prefs.prefs,startupAnimation:'off'}}}});
 await page.request.post('/api/scenario',{data:{name:'Playback'}});
 await page.goto('/?gui=2&screen=1&display=dsi-production'+(wall?'&panel=wall-16-10':''));
 let release;const held=new Promise(resolve=>{release=resolve;});
 await page.route('**/api/event',async route=>{await held;await route.continue();});
 try{
  const next=page.getByRole('button',{name:'Next track',exact:true});await next.click();
  await expect(next).toHaveAttribute('aria-busy','true');await expect(next).toBeDisabled();
  await expect(page.locator('.m2-player-status')).toHaveAttribute('data-feedback','pending');
  const footer=await page.locator('.m2-player-status').evaluate(n=>getComputedStyle(n,'::before').content);
  expect(['none','normal']).toContain(footer);
  expect(await next.evaluate(n=>getComputedStyle(n,'::after').content)).toBe('""');
  release();await expect(next).toHaveAttribute('aria-busy','false');await expect(next).toBeEnabled();
 }finally{release();await page.unrouteAll({behavior:'wait'});}
});
