import {test,expect} from '@playwright/test';
test.use({viewport:{width:1280,height:800}});
test('never-visited optional setup wizards load offline and cannot claim a hardware result',async({page,context})=>{
 const token=(await(await page.request.get('/api/updates')).json()).controlToken,headers={'X-TuneBox-Control':token};
 await page.request.post('/api/reset',{headers,data:{kind:'preferences',confirmed:true}});
 const p=await(await page.request.get('/api/preferences')).json();await page.request.post('/api/preferences',{headers,data:{revision:p.revision,patch:{setupCompleted:true,prefs:{...p.prefs,startupAnimation:'off'}}}});
 await page.goto('/?gui=2&screen=1&display=dsi-production&panel=wall-16-10');await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(v=>v.name));expect(resources.some(v=>/\/assets\/(SoundWizard|SyncWizard|MusicAssistantWizard)-/.test(v))).toBe(false);
 const inventory=await page.evaluate(async()=>{const assets=await(await fetch('/offline-assets.json')).json();return Promise.all(assets.filter(p=>/\/assets\/(SoundWizard|SyncWizard|MusicAssistantWizard)-/.test(p)).map(async path=>({path,cached:!!await caches.match(path)})));});expect(inventory).toHaveLength(3);expect(inventory.every(a=>a.cached)).toBe(true);
 await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('navigation',{name:'Settings categories'}).getByRole('button',{name:'Audio & DSP',exact:true}).click();
 for(const [button,title] of [['Open sound setup','Sound & DSP setup'],['Open synchronization wizard','Picture & meter sync']]){
  await page.getByRole('button',{name:button,exact:true}).click();const wizard=page.getByRole('dialog',{name:title,exact:true});await expect(wizard).toBeVisible();await expect(wizard.getByRole('button',{name:'Continue',exact:true})).toBeDisabled();await wizard.getByRole('button',{name:'Finish later',exact:true}).click();await expect(wizard).not.toBeVisible();
 }
});
