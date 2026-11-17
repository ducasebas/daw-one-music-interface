import {test,expect} from '@playwright/test';

const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800}});

async function openUpdates(page){
  await page.goto(url);await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('navigation',{name:'Settings categories'}).getByRole('button',{name:'System',exact:true}).click();
  await page.getByRole('navigation',{name:'In this section'}).getByRole('button',{name:'Updates',exact:true}).click();
}

test('manual update offers cancel before pausing a group and shows pending feedback',async({page})=>{
  const original=await(await page.request.get('/api/updates')).json();const requests=[];
  await page.route('**/api/updates',r=>r.fulfill({json:{...original,status:'available',available:{commit:'a'.repeat(40),release:'new-test'},manager:{...original.manager,managed:true,configured:true}}}));
  await page.route('**/api/device',async r=>{
    const request=r.request().postDataJSON();if(request.command!=='install')return r.continue();requests.push(request);
    await new Promise(resolve=>setTimeout(resolve,400));
    return r.fulfill({status:409,json:{code:'update-group-confirmation',error:'Installing will pause these rooms. Confirm before continuing.',rooms:[{id:'rivo',name:'Rivo'},{id:'tb',name:'TuneBox'}],roomsRevision:'a'.repeat(64)}});
  });
  await openUpdates(page);await page.getByRole('button',{name:'Install update',exact:true}).click();
  await expect(page.getByRole('button',{name:'Preparing update…',exact:true})).toBeDisabled();await expect(page.getByText('Pausing playback and checking the device…',{exact:true})).toBeVisible();
  const dialog=page.getByRole('alertdialog',{name:'Pause rooms for update'});await expect(dialog).toBeVisible();await expect(dialog.getByRole('listitem')).toHaveText(['Rivo','TuneBox']);
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).not.toBeVisible();expect(requests).toEqual([{command:'install',args:{}}]);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBe(800);
});

test('changed groups require a new confirmation and forward only the latest revision',async({page})=>{
  const original=await(await page.request.get('/api/updates')).json();const requests=[];
  await page.route('**/api/updates',r=>r.fulfill({json:{...original,status:'available',available:{commit:'a'.repeat(40),release:'new-test'},manager:{...original.manager,managed:true,configured:true}}}));
  await page.route('**/api/device',r=>{
    const request=r.request().postDataJSON();if(request.command!=='install')return r.continue();requests.push(request);
    if(requests.length===3)return r.fulfill({json:{queued:true,pausedForUpdate:true}});
    const changed=requests.length===2;
    return r.fulfill({status:409,json:{code:'update-group-confirmation',error:'Installing will pause these rooms. Confirm before continuing.',rooms:[{id:'rivo',name:'Rivo'},{id:'tb',name:'TuneBox'},...(changed?[{id:'hall',name:'Hall'}]:[])],roomsRevision:(changed?'b':'a').repeat(64)}});
  });
  await openUpdates(page);await page.getByRole('button',{name:'Install update',exact:true}).click();
  const dialog=page.getByRole('alertdialog',{name:'Pause rooms for update'});await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Pause rooms and install',exact:true}).click();
  await expect(dialog.getByRole('listitem')).toHaveText(['Rivo','TuneBox','Hall']);await dialog.getByRole('button',{name:'Pause rooms and install',exact:true}).click();
  await expect(dialog).not.toBeVisible();expect(requests).toEqual([{command:'install',args:{}},{command:'install',args:{pauseGroup:true,roomsRevision:'a'.repeat(64)}},{command:'install',args:{pauseGroup:true,roomsRevision:'b'.repeat(64)}}]);
});
