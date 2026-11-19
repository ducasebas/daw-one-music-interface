import {test,expect,devices} from '@playwright/test';
import {chooseSettingsSection} from '../browser/settings-helpers.js';
test.use({viewport:{width:1280,height:800}});
const phone={...devices['iPhone 13'],browserName:undefined,defaultBrowserType:undefined};

async function freshWall(page){
 const token=(await(await page.request.get('/api/updates')).json()).controlToken,headers={'X-TuneBox-Control':token};
 await page.request.post('/api/reset',{headers,data:{kind:'preferences',confirmed:true}});
 await page.request.post('/api/remote/forget',{headers,data:{all:true}});
 const p=await(await page.request.get('/api/preferences')).json();await page.request.post('/api/preferences',{headers,data:{revision:p.revision,patch:{setupCompleted:true,prefs:{...p.prefs,startupAnimation:'off'}}}});
 await page.goto('/?gui=2&screen=1&display=dsi-production&panel=wall-16-10');
 return headers;
}
async function openRemoteWizard(page){
 await page.getByRole('button',{name:'Settings',exact:true}).click();await chooseSettingsSection(page,'Connections');
 await page.getByRole('button',{name:'Phone remote',exact:true}).last().click();
 await expect(page.getByText('No phones are paired.')).toBeVisible();
 await page.getByRole('button',{name:'Pair a phone…',exact:true}).click();
 const wizard=page.getByRole('dialog',{name:'Phone remote',exact:true});await expect(wizard).toBeVisible();
 const shown=page.waitForResponse(r=>r.url().endsWith('/api/remote/pairing')&&r.request().method()==='POST');
 await wizard.getByRole('button',{name:'Show QR code',exact:true}).click();
 const pair=await(await shown).json();
 await expect(wizard.getByRole('img',{name:'Scan with your phone camera'})).toBeVisible();
 await expect(wizard.getByText('Waiting for your phone…')).toBeVisible();
 // The visible address never shows the single-use pairing secret.
 await expect(wizard.locator('code')).not.toContainText('#pair=');
 return {wizard,url:pair.url};
}

test('the wall wizard pairs a phone by QR code and the phone controls playback with bounded volume',async({page,browser})=>{
 await freshWall(page);
 const {wizard,url}=await openRemoteWizard(page);
 expect(url).toMatch(/\/remote\.html#pair=[a-f0-9]{48}$/);
 const context=await browser.newContext(phone),remote=await context.newPage();
 try{
  await remote.goto(url);
  await expect(remote.getByRole('button',{name:/^(Play|Pause)$/})).toBeVisible();
  expect(new URL(remote.url()).hash).toBe('');
  await expect(wizard.getByText('Your phone is paired')).toBeVisible();
  await wizard.getByRole('button',{name:'Done',exact:true}).click();
  await expect(page.getByText(/^(iPhone|Phone)$/).first()).toBeVisible();
  const meter=remote.getByRole('meter',{name:'Volume'}),before=Number(await meter.getAttribute('aria-valuenow'));
  await remote.getByRole('button',{name:'Volume up'}).click();
  await expect(meter).toHaveAttribute('aria-valuenow',String(before+5));
  if(await remote.getByRole('button',{name:'Play',exact:true}).isVisible())await remote.getByRole('button',{name:'Play',exact:true}).click();
  await expect(remote.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
  await remote.getByRole('button',{name:'Next',exact:true}).click();
  await expect(remote.getByRole('status').filter({hasText:'Working…'})).toHaveCount(0);
  await expect(remote.getByText('Search needs a connected Music Assistant.')).toBeVisible();
  // Every interactive control is a comfortable touch target on a phone.
  for(const box of await remote.locator('main button').evaluateAll(list=>list.map(b=>b.getBoundingClientRect()).filter(r=>r.width).map(r=>({w:r.width,h:r.height}))))expect(Math.min(box.w,box.h)).toBeGreaterThanOrEqual(44);
  expect(await remote.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  // A second scan of the same code is refused.
  const other=await browser.newContext(phone),again=await other.newPage();
  await again.goto(url);await expect(again.getByRole('heading',{name:'Scan the QR code on TuneBox'})).toBeVisible();await other.close();
 }finally{await context.close();}
});

test('forgetting the phone on the wall revokes it, and a phone can unpair itself',async({page,browser})=>{
 const headers=await freshWall(page);
 const {url}=await openRemoteWizard(page);
 const context=await browser.newContext(phone),remote=await context.newPage();
 try{
  await remote.goto(url);await expect(remote.getByRole('button',{name:'Next',exact:true})).toBeVisible();
  const id=(await(await page.request.get('/api/remote/phones')).json()).phones[0].id;
  await page.request.post('/api/remote/forget',{headers,data:{id}});
  await remote.getByRole('button',{name:'Next',exact:true}).click();
  await expect(remote.getByRole('heading',{name:'Scan the QR code on TuneBox'})).toBeVisible();
  // Pair again and unpair from the phone itself.
  await page.keyboard.press('Escape');
  const shown=await(await page.request.post('/api/remote/pairing',{headers,data:{action:'start'}})).json();
  // A camera scan opens the code as a new page load.
  await remote.goto('about:blank');await remote.goto(shown.url);await expect(remote.getByRole('button',{name:'Next',exact:true})).toBeVisible();
  await remote.getByRole('button',{name:'Unpair this phone'}).click();
  await remote.getByRole('dialog',{name:'Unpair this phone'}).getByRole('button',{name:'Unpair',exact:true}).click();
  await expect(remote.getByRole('heading',{name:'Scan the QR code on TuneBox'})).toBeVisible();
  expect((await(await page.request.get('/api/remote/phones')).json()).phones).toEqual([]);
 }finally{await context.close();}
});

test('phone search offers play now and add to queue with owned pending feedback',async({page,browser})=>{
 const headers=await freshWall(page);
 const shown=await(await page.request.post('/api/remote/pairing',{headers,data:{action:'start'}})).json();
 const context=await browser.newContext(phone),remote=await context.newPage();
 try{
  const state=await(async()=>{await remote.goto(shown.url);await expect(remote.getByRole('button',{name:'Next',exact:true})).toBeVisible();return remote.evaluate(()=>fetch('/api/remote/state').then(r=>r.json()));})();
  const view={...state,mode:'music-assistant',searchAvailable:true};
  await remote.route('**/api/remote/events',route=>route.fulfill({status:200,headers:{'Content-Type':'text/event-stream'},body:`data: ${JSON.stringify(view)}\n\n`}));
  const plays=[];let release;const gate=new Promise(r=>release=r);
  await remote.route('**/api/remote/search*',route=>route.fulfill({json:{items:[{id:'a'.repeat(24),type:'track',name:'Teardrop',artist:'Massive Attack',available:true,artwork:null},{id:'b'.repeat(24),type:'artist',name:'Massive Attack',artist:'',available:true,artwork:null}],hasMore:false}}));
  await remote.route('**/api/remote/play',async route=>{plays.push(route.request().postDataJSON());await gate;await route.fulfill({json:view});});
  await remote.reload();
  const search=remote.getByRole('searchbox',{name:'Search music'});await expect(search).toBeVisible();
  await search.fill('teardrop');await search.press('Enter');
  const row=remote.getByRole('listitem').filter({hasText:'Teardrop'});await expect(row).toBeVisible();
  // Artists cannot be queued directly.
  await expect(remote.getByRole('listitem').filter({hasText:/^Massive Attack/}).getByRole('button')).toHaveCount(0);
  await row.getByRole('button',{name:'Add to queue'}).click();
  await expect(remote.getByText('Working…')).toBeVisible();
  await expect(row.getByRole('button',{name:'Play now'})).toBeDisabled();
  release();
  await expect(remote.getByText('Added to the queue')).toBeVisible();
  await row.getByRole('button',{name:'Play now'}).click();await expect(remote.getByText('Playing now')).toBeVisible();
  expect(plays).toEqual([{id:'a'.repeat(24),option:'add'},{id:'a'.repeat(24),option:'replace'}]);
 }finally{await context.close();}
});
