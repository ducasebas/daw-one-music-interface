import {test,expect} from '@playwright/test';
import {chooseSettingsSection} from './settings-helpers.js';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800}});
const defaults={ina228:false,husb238:false,currentPathVerified:false,voltageSenseVerified:false,startup100W:false};
function reading(at=Date.now(),amps=3){return {observedAt:at,watts:12.4,volts:20,amps:.62,contractWatts:20*amps,
 ina228:{status:'ok',source:'INA228',observedAt:at},pd:{status:'active',source:'HUSB238',observedAt:at,attached:true,volts:20,amps,profiles:[{volts:5,amps:3,watts:15},{volts:20,amps:5,watts:100}]}};}
async function fixture(page,{power=()=>reading(),fail=false,requestError='',requestDelay=0,legacy=false}={}){
 const token=(await(await page.request.get('/api/updates')).json()).controlToken;
 await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':token},data:{kind:'preferences',confirmed:true}});
 await page.request.post('/api/scenario',{data:{name:'Playback'}});
 const settings={...defaults},writes=[],commands=[],requests=[];let reads=0,pdQualified=false;
 const status=()=>{const {startup100W,...readers}=settings;return {supported:true,settings:readers,readOnly:true,...(!legacy?{negotiationSupported:true,pdQualified,startup100W}:{})};};
 // Exercise sensor settings independently of the separate startup-media journey.
 const snapshot=async()=>{const s=await(await page.request.get('/api/state')).json();s.preferences.prefs.startupAnimation='off';s.hostTelemetry={...s.hostTelemetry,power:power()};return s;};
 await page.route('**/api/state',async route=>route.fulfill({json:await snapshot()}));
 await page.route('**/api/events',async route=>route.fulfill({contentType:'text/event-stream',body:`data: ${JSON.stringify(await snapshot())}\n\n`}));
 await page.route('**/api/device',async route=>{
  const body=route.request().postDataJSON();
  commands.push(body.command);
  if(body.command==='clock')return route.fulfill({json:{supported:true,synchronized:true,timeZone:'Europe/Amsterdam',automatic:true}});
  if(body.command==='clock-set')return route.fulfill({status:409,json:{error:'Sensor changes must not reset an unchanged system clock.'}});
  if(body.command==='power-status'){reads++;return route.fulfill({json:status()});}
  if(body.command==='power-request-100w'){
   requests.push(body);
   if(requestDelay)await new Promise(resolve=>setTimeout(resolve,requestDelay));
   if(requestError)return route.fulfill({status:409,json:{error:requestError}});
   Object.assign(settings,{husb238:true,startup100W:body.args.startup});pdQualified=true;
   return route.fulfill({json:{...status(),saved:true,pd:{verified:true,volts:20,amps:5,watts:100}}});
  }
  if(body.command==='power-config'){
   if(legacy&&Object.hasOwn(body.args.settings,'startup100W'))return route.fulfill({status:409,json:{error:'The older helper only accepts four reader settings'}});
   writes.push(body);if(fail)return route.fulfill({status:409,json:{error:'Power monitoring could not start. Previous settings were restored.'}});
   Object.assign(settings,body.args.settings);return route.fulfill({json:{...status(),saved:true}});
  }
  return route.continue();
 });
 return {writes,reads:()=>reads,settings,commands,requests};
}
async function open(page){await page.goto(url);await chooseSettingsSection(page,'Sensors',{open:true});await expect(page.getByRole('checkbox',{name:'Read INA228 consumption',exact:true})).toBeEnabled();}

test('power setup stages boolean-only edits, cancels cleanly and saves through the main Save bar',async({page})=>{
 const f=await fixture(page);await open(page);
 const ina=page.getByRole('checkbox',{name:'Read INA228 consumption',exact:true}),pd=page.getByRole('checkbox',{name:'Read HUSB238 PD contract',exact:true});
 const save=page.getByRole('button',{name:'Save',exact:true});
 await ina.check();await pd.check();await expect(save).toBeEnabled();expect(f.writes).toHaveLength(0);
 await expect(page.getByRole('button',{name:'Refresh power setup',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(ina).not.toBeChecked();await expect(pd).not.toBeChecked();expect(f.writes).toHaveLength(0);
 await ina.check();await pd.check();
 await page.getByRole('checkbox',{name:'The monitored current flows through VIN+ and VIN−.',exact:true}).check();
 await page.getByRole('checkbox',{name:'VBUS senses the monitored supply voltage.',exact:true}).check();
 await save.click();await expect(page.locator('[data-saved="true"]')).toBeVisible();
 expect(f.writes).toEqual([{command:'power-config',args:{settings:{ina228:true,husb238:true,currentPathVerified:true,voltageSenseVerified:true,startup100W:false}}}]);
 expect(f.commands).not.toContain('clock-set');
 await expect(save).toBeDisabled();expect(f.reads()).toBe(1);
 await page.getByRole('button',{name:'Restore defaults',exact:true}).click();await expect(ina).not.toBeChecked();await expect(pd).not.toBeChecked();
 await expect(save).toBeEnabled();expect(f.writes).toHaveLength(1);
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(ina).toBeChecked();await expect(pd).toBeChecked();
});

test('a failed reader activation keeps the staged changes and offers retry without claiming Saved',async({page})=>{
 const f=await fixture(page,{fail:true});await open(page);
 const pd=page.getByRole('checkbox',{name:'Read HUSB238 PD contract',exact:true});await pd.check();
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.locator('.power-configuration').getByRole('alert')).toContainText('Previous settings were restored.');
 await expect(page.locator('[data-saved="true"]')).toHaveCount(0);await expect(pd).toBeChecked();
 await expect(page.getByRole('button',{name:'Save',exact:true})).toBeEnabled();expect(f.settings).toEqual(defaults);expect(f.writes).toHaveLength(1);
});

test('low negotiated power leads from the hardware notification to readable sensor cards and offered profiles',async({page})=>{
 await fixture(page);await page.goto(url);
 await page.getByRole('button',{name:'Notifications',exact:true}).click();
 const tray=page.getByRole('dialog',{name:'Notification panel'});
 await tray.getByRole('button',{name:'Hardware alert',exact:true}).click();
 await expect(tray).toContainText('Power supply below requirement');
 await tray.getByRole('button',{name:'Open Hardware alert',exact:true}).click();
 await expect(page.locator('[data-section="sensors"]')).toHaveAttribute('data-current','true');
 const cards=page.getByRole('region',{name:'Power supply status',exact:true});
 await expect(cards.getByRole('article',{name:'Measured consumption',exact:true})).toContainText('12.4 W');
 await expect(cards.getByRole('article',{name:'Negotiated PD capacity',exact:true})).toContainText('60 W');
 await expect(cards.getByRole('list',{name:'Available power profiles',exact:true})).toContainText('100 W');
 await expect(cards.locator('select')).toHaveCount(0);
 expect(await cards.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.screenshot({path:'test-results/power-contract.png'});
});

test('fresh consumption can be zero but expired readings clear the numbers and healthy PD state',async({page})=>{
 const at=Date.now();await page.clock.install({time:at-1000});await page.clock.pauseAt(at);
 await fixture(page,{power:()=>({...reading(at,5),watts:0,amps:0})});
 await page.goto(url);await page.clock.runFor(5000);await chooseSettingsSection(page,'Sensors',{open:true});
 const cards=page.getByRole('region',{name:'Power supply status',exact:true});
 await expect(cards.getByRole('article',{name:'Measured consumption',exact:true})).toContainText('0.0 W');
 await expect(cards.locator('[data-severity="ok"]')).toBeVisible();
 await page.clock.fastForward(7100);
 await expect(cards.getByRole('article',{name:'Measured consumption',exact:true}).locator('strong')).toHaveText('Unavailable',{timeout:10000});
 await expect(cards.locator('[data-severity="ok"]')).toHaveCount(0);
 await expect(cards.getByRole('list',{name:'Available power profiles',exact:true})).toHaveCount(0);
});

test('a newer GUI can save reader settings with an older helper while 100 W setup stays unavailable',async({page})=>{
 const f=await fixture(page,{legacy:true});await open(page);
 await expect(page.getByRole('button',{name:'Set up 100 W',exact:true})).toBeDisabled();
 await page.getByRole('checkbox',{name:'Read INA228 consumption',exact:true}).check();
 await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('[data-saved="true"]')).toBeVisible();
 expect(f.writes).toEqual([{command:'power-config',args:{settings:{ina228:true,husb238:false,currentPathVerified:false,voltageSenseVerified:false}}}]);
 expect(f.requests).toHaveLength(0);
});

test('voltage, current and PD capacity can be selected for the home menu without changing the reader',async({page})=>{
 const f=await fixture(page);await open(page);
 for(const name of ['Supply voltage','Supply current','Negotiated PD capacity'])await page.getByRole('checkbox',{name,exact:true}).check();
 await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('[data-saved="true"]')).toBeVisible();
 expect(f.writes).toHaveLength(0);
 await page.getByRole('button',{name:'Open Now Playing',exact:true}).click();await page.locator('.m2-header nav').getByRole('button',{name:'Discover',exact:true}).click();
 await expect(page.locator('.home-readouts article')).toHaveCount(3);
 for(const value of ['20.00 V','0.620 A','60 W'])await expect(page.locator('.home-readouts')).toContainText(value);
});

test('100 W setup requires a separate cable confirmation, shows pending feedback and preserves sensor wiring',async({page})=>{
 const f=await fixture(page,{requestDelay:800});await open(page);
 const setup=page.getByRole('button',{name:'Set up 100 W',exact:true});await setup.click();
 const dialog=page.getByRole('dialog',{name:'100 W power setup',exact:true});
 const request=dialog.getByRole('button',{name:'Request and verify 100 W',exact:true});
 await expect(dialog).toContainText('briefly interrupt power');await expect(request).toBeDisabled();
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.screenshot({path:'test-results/pd-setup-dialog.png'});
 await dialog.getByRole('checkbox',{name:'I verified a 100 W USB-C PD supply and a 5 A e-marked cable.',exact:true}).check();
 const startup=dialog.getByRole('checkbox',{name:'Repeat verified 100 W setup at startup',exact:true});await expect(startup).not.toBeChecked();await startup.check();
 expect(f.requests).toHaveLength(0);await request.click();
 await expect(dialog.getByRole('status')).toContainText('Requesting and verifying');await expect(request).toBeDisabled();
 await expect(dialog.getByRole('button',{name:'Cancel',exact:true})).toBeDisabled();await request.dispatchEvent('click');
 await expect(dialog).toHaveCount(0);await expect(page.locator('.power-pd-success')).toContainText('20 V / 5 A confirmed');
 expect(f.requests).toEqual([{command:'power-request-100w',args:{confirmed:true,cable5AVerified:true,startup:true}}]);
 expect(f.writes).toHaveLength(0);expect(f.settings.currentPathVerified).toBe(false);expect(f.settings.voltageSenseVerified).toBe(false);
 await expect(page.getByRole('checkbox',{name:'Repeat verified 100 W setup at startup',exact:true})).toBeChecked();
 await expect(page.getByRole('button',{name:'Save',exact:true})).toBeDisabled();
});

test('100 W setup cannot bypass staged changes and cancel does not negotiate',async({page})=>{
 const f=await fixture(page);await open(page);
 const setup=page.getByRole('button',{name:'Set up 100 W',exact:true});
 await page.getByRole('checkbox',{name:'Read INA228 consumption',exact:true}).check();await expect(setup).toBeDisabled();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(setup).toBeEnabled();await setup.click();
 const dialog=page.getByRole('dialog',{name:'100 W power setup',exact:true});
 await dialog.getByRole('checkbox',{name:'I verified a 100 W USB-C PD supply and a 5 A e-marked cable.',exact:true}).check();
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).toHaveCount(0);
 expect(f.requests).toHaveLength(0);expect(f.writes).toHaveLength(0);
});

test('a rejected 100 W contract remains an error and does not claim Saved or retry automatically',async({page})=>{
 const f=await fixture(page,{requestError:'The connected supply and cable do not offer a 20 V / 5 A profile'});await open(page);
 await page.getByRole('button',{name:'Set up 100 W',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'100 W power setup',exact:true});
 await dialog.getByRole('checkbox',{name:'I verified a 100 W USB-C PD supply and a 5 A e-marked cable.',exact:true}).check();
 await dialog.getByRole('button',{name:'Request and verify 100 W',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText('do not offer');await expect(page.locator('.power-pd-success')).toHaveCount(0);
 expect(f.requests).toHaveLength(1);expect(f.writes).toHaveLength(0);expect(f.settings.startup100W).toBe(false);
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
});

test('unconfirmed VBUS gives a physical wiring explanation instead of zero consumption',async({page})=>{
 await fixture(page,{power:()=>({...reading(Date.now(),1.25),watts:null,volts:null,amps:null,ina228:{status:'needs-setup',missingConfirmations:['voltage-sense']}})});await open(page);
 const cards=page.getByRole('region',{name:'Power supply status',exact:true}),consumption=cards.getByRole('article',{name:'Measured consumption',exact:true});
 await expect(consumption.locator('strong')).toHaveText('Unavailable');await expect(consumption).toContainText('VBUS must be physically connected');
 await expect(cards).toContainText('25 W is 20 V × 1.25 A');await expect(consumption).not.toContainText('0.0 W');
 await consumption.locator('strong').scrollIntoViewIfNeeded();
 await page.screenshot({path:'test-results/pd-vbus-unconfirmed.png'});
});
