import {test,expect} from '@playwright/test';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800}});
const shot=async(page,name)=>{if(process.env.TUNEBOX_SHOTS)await page.screenshot({path:process.env.TUNEBOX_SHOTS+'/'+name+'.png'});};
const notes='GUI 9.9.9 · TEST — Room correction is now a guided wizard. Bluetooth shows the real codec and bitrate. Updates show what to expect.';
async function updates(page,extra){const original=await(await page.request.get('/api/updates')).json();await page.route('**/api/updates',r=>r.fulfill({json:{...original,manager:{...original.manager,managed:true,configured:true},available:{commit:'b'.repeat(40),release:'new-test',label:'GUI 9.9.9 · TEST',notes},...extra}}));}
test('Install opens a full-screen review with duration, changelog and what to expect before anything happens',async({page})=>{
 await updates(page,{status:'available',typicalSeconds:154});const installs=[];
 await page.route('**/api/device',r=>{const q=r.request().postDataJSON();if(q.command==='install'){installs.push(q);return r.fulfill({json:{queued:true}});}return r.continue();});
 await page.goto(url);await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('navigation',{name:'Settings categories'}).getByRole('button',{name:'System',exact:true}).click();await page.getByRole('navigation',{name:'In this section'}).getByRole('button',{name:'Updates',exact:true}).click();
 await page.getByRole('button',{name:'Install update',exact:true}).click();
 const sheet=page.getByRole('dialog',{name:'Install this update?'});await expect(sheet.getByRole('heading',{name:'GUI 9.9.9 · TEST'})).toBeVisible();
 await expect(sheet.getByText('Usually takes: 2:34 min')).toBeVisible();await expect(sheet.getByRole('listitem').filter({hasText:'Bluetooth shows the real codec and bitrate.'})).toBeVisible();
 await expect(sheet.getByText(/TuneBox shows a restart countdown/)).toBeVisible();expect(installs).toHaveLength(0);
 const box=await sheet.boundingBox();expect(box.width).toBe(1280);expect(box.height).toBe(800);await shot(page,'update-review');
 await sheet.getByRole('button',{name:'Not now',exact:true}).click();await expect(sheet).toHaveCount(0);expect(installs).toHaveLength(0);
 await page.getByRole('button',{name:'Install update',exact:true}).click();await page.getByRole('button',{name:'Install now',exact:true}).click();await expect.poll(()=>installs.length).toBe(1);
});
test('a running update covers the screen with progress, elapsed time, estimate, changelog and expectations',async({page})=>{
 await updates(page,{status:'downloading',percent:42,startedAt:new Date(Date.now()-65000).toISOString(),typicalSeconds:180});
 await page.goto(url);const sheet=page.getByRole('dialog',{name:'Software update'});
 await expect(sheet.getByRole('heading',{name:'GUI 9.9.9 · TEST'})).toBeVisible();await expect(sheet.getByRole('progressbar',{name:'Update progress'})).toHaveJSProperty('value',42);
 await expect(sheet.getByText(/Elapsed: 1:0\d min/)).toBeVisible();await expect(sheet.getByText('Usually takes: 3:00 min')).toBeVisible();
 await expect(sheet.getByRole('listitem').filter({hasText:'Room correction is now a guided wizard.'})).toBeVisible();await expect(sheet.getByText(/TuneBox shows a restart countdown/)).toBeVisible();
 await shot(page,'update-running');
});
test('a maintenance failure remains visible on the update settings page after a check',async({page})=>{
 await updates(page,{status:'available',error:null,maintenance:{step:'interrupted',status:'interrupted',label:'System maintenance was interrupted'}});
 await page.goto(url);await page.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('navigation',{name:'Settings categories'}).getByRole('button',{name:'System',exact:true}).click();
 await page.getByRole('navigation',{name:'In this section'}).getByRole('button',{name:'Updates',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'System maintenance was interrupted'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Install update',exact:true})).toBeEnabled();
});
