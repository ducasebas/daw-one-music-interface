import {test,expect} from '@playwright/test';
import {chooseSettingsSection} from './settings-helpers.js';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800}});
const defaults={ina228:false,husb238:false,currentPathVerified:false,voltageSenseVerified:false};
function reading(at=Date.now(),amps=3){return {observedAt:at,watts:12.4,volts:20,amps:.62,contractWatts:20*amps,
 ina228:{status:'ok',source:'INA228',observedAt:at},pd:{status:'active',source:'HUSB238',observedAt:at,attached:true,volts:20,amps,profiles:[{volts:5,amps:3,watts:15},{volts:20,amps:5,watts:100}]}};}
async function fixture(page,{power=()=>reading(),fail=false}={}){
 const token=(await(await page.request.get('/api/updates')).json()).controlToken;
 await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':token},data:{kind:'preferences',confirmed:true}});
 await page.request.post('/api/scenario',{data:{name:'Playback'}});
 const settings={...defaults},writes=[],commands=[];let reads=0;
 const snapshot=async()=>{const s=await(await page.request.get('/api/state')).json();s.hostTelemetry={...s.hostTelemetry,power:power()};return s;};
 await page.route('**/api/state',async route=>route.fulfill({json:await snapshot()}));
 await page.route('**/api/events',async route=>route.fulfill({contentType:'text/event-stream',body:`data: ${JSON.stringify(await snapshot())}\n\n`}));
 await page.route('**/api/device',async route=>{
  const body=route.request().postDataJSON();
  commands.push(body.command);
  if(body.command==='clock')return route.fulfill({json:{supported:true,synchronized:true,timeZone:'Europe/Amsterdam',automatic:true}});
  if(body.command==='clock-set')return route.fulfill({status:409,json:{error:'Sensor changes must not reset an unchanged system clock.'}});
  if(body.command==='power-status'){reads++;return route.fulfill({json:{supported:true,settings,readOnly:true}});}
  if(body.command==='power-config'){
   writes.push(body);if(fail)return route.fulfill({status:409,json:{error:'Power monitoring could not start. Previous settings were restored.'}});
   Object.assign(settings,body.args.settings);return route.fulfill({json:{supported:true,settings,saved:true,readOnly:true}});
  }
  return route.continue();
 });
 return {writes,reads:()=>reads,settings,commands};
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
 expect(f.writes).toEqual([{command:'power-config',args:{settings:{ina228:true,husb238:true,currentPathVerified:true,voltageSenseVerified:true}}}]);
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
 const at=Date.now();await fixture(page,{power:()=>({...reading(at,5),watts:0,amps:0})});await open(page);
 const cards=page.getByRole('region',{name:'Power supply status',exact:true});
 await expect(cards.getByRole('article',{name:'Measured consumption',exact:true})).toContainText('0.0 W');
 await expect(cards.locator('[data-severity="ok"]')).toBeVisible();
 await expect(cards.getByRole('article',{name:'Measured consumption',exact:true}).locator('strong')).toHaveText('Unavailable',{timeout:10000});
 await expect(cards.locator('[data-severity="ok"]')).toHaveCount(0);
 await expect(cards.getByRole('list',{name:'Available power profiles',exact:true})).toHaveCount(0);
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
