import {test,expect} from '@playwright/test';
import {chooseSettingsSection,chooseDeveloperTopic} from './settings-helpers.js';
import {createProgressServer} from '../../deploy/manager/progress-server.mjs';

const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800}});
test.beforeEach(async({page})=>{
 const token=(await(await page.request.get('/api/updates')).json()).controlToken;
 await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':token},data:{kind:'preferences',confirmed:true}});
 await page.request.post('/api/scenario',{data:{name:'Playback'}});
});
test.afterEach(async({page})=>{await page.unrouteAll({behavior:'wait'});});

test('manual timing, startup diagnostics and local server installation are in Developer rather than everyday audio',async({page})=>{
 await page.goto(url);await chooseSettingsSection(page,'Audio',{open:true});
 await expect(page.getByRole('button',{name:'Open synchronization wizard',exact:true})).toBeVisible();
 await expect(page.getByRole('slider',{name:'Screen delay',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Advanced audio settings',exact:true}).click();
 await expect(page.getByRole('slider',{name:'Screen delay',exact:true})).toBeVisible();
 await chooseDeveloperTopic(page,'Startup');await expect(page.getByText('Splash diagnostics',{exact:true})).toBeVisible();
 await chooseSettingsSection(page,'Connections');await page.getByRole('button',{name:'Music Assistant',exact:true}).click();
 await expect(page.getByRole('button',{name:'Install local server…',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Advanced server options',exact:true}).click();await expect(page.getByRole('button',{name:'Install local server…',exact:true})).toBeVisible();
});

test('slow sound changes show device activity, reject duplicate taps and leave a clear error when rejected',async({page})=>{
 const state=await(await page.request.get('/api/state')).json();state.preferences.prefs.startupAnimation='off';state.automaticDsp={settings:{enabled:true},activeProfile:'warm'};
 await page.route('**/api/state',route=>route.fulfill({json:state}));await page.route('**/api/events',route=>route.fulfill({contentType:'text/event-stream',body:`data: ${JSON.stringify(state)}\n\n`}));
 let requests=0;
 await page.route('**/api/device',async route=>{
  if(route.request().postDataJSON().command!=='dsp-auto-config')return route.continue();
  requests++;await new Promise(resolve=>setTimeout(resolve,900));return route.fulfill({status:409,json:{error:'The amplifier is unavailable. Try again.'}});
 });
 await page.goto(url);await chooseSettingsSection(page,'Audio',{open:true});
 const button=page.getByRole('button',{name:'Switch to manual sound',exact:true});await button.click();
 await expect(page.getByRole('status',{name:'Device activity',exact:true})).toContainText('Applying sound settings…');await expect(button).toBeDisabled();await button.dispatchEvent('click');
 await expect(page.getByRole('status',{name:'Device activity',exact:true})).toHaveCount(0);await expect(page.getByText('The amplifier is unavailable. Try again.',{exact:true})).toBeVisible();expect(requests).toBe(1);
});

test('temporary Wi-Fi visibly starts and a failed stop preserves the QR connection details',async({page})=>{
 let starts=0,stops=0;
 await page.route('**/api/device',async route=>{
  const body=route.request().postDataJSON();
  if(body.command==='wifi-scan')return route.fulfill({json:{supported:true,interface:'wlan0',hotspotSupported:true,networks:[]}});
  if(body.command==='hotspot-start'){starts++;await new Promise(resolve=>setTimeout(resolve,750));return route.fulfill({json:{ssid:'TuneBox-test',password:'test-only-password',setupUrl:'http://10.42.0.1:3003/?setup=phone',expires:Date.now()+600000,simulated:true}});}
  if(body.command==='hotspot-stop'){stops++;await new Promise(resolve=>setTimeout(resolve,750));return route.fulfill({status:409,json:{error:'Temporary Wi-Fi could not stop. Try again.'}});}
  return route.continue();
 });
 await page.goto(url);await chooseSettingsSection(page,'Connections',{open:true});
 await page.getByRole('button',{name:'Set up with phone',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Start setup hotspot',exact:true});await dialog.getByRole('button',{name:'Start hotspot',exact:true}).click();
 await expect(dialog.getByRole('status')).toContainText('Starting temporary Wi-Fi…');await expect(dialog.getByRole('button',{name:'Cancel',exact:true})).toBeDisabled();
 await expect(dialog).toHaveCount(0);await expect(page.getByRole('img',{name:'1. Join TuneBox Wi-Fi',exact:true})).toBeVisible();
 const stop=page.getByRole('button',{name:'Stop hotspot',exact:true});await stop.click();await expect(page.getByRole('button',{name:'Stopping temporary Wi-Fi…',exact:true})).toBeDisabled();
 await expect(page.getByRole('alert')).toContainText('Temporary Wi-Fi could not stop');await expect(page.getByRole('img',{name:'1. Join TuneBox Wi-Fi',exact:true})).toBeVisible();expect(starts).toBe(1);expect(stops).toBe(1);
});

test('debug loading and saving always show progress and return to usable controls',async({page})=>{
 let enabled=false;
 await page.route('**/api/debug',async route=>{await new Promise(resolve=>setTimeout(resolve,650));if(route.request().method()==='POST')enabled=route.request().postDataJSON().enabled;return route.fulfill({json:{enabled}});});
 await page.goto(url);await chooseDeveloperTopic(page,'Debug',{open:true});await expect(page.getByRole('status').filter({hasText:'Loading debug status…'})).toBeVisible();
 const start=page.getByRole('button',{name:'Start debug capture',exact:true});await expect(start).toBeEnabled();await start.click();
 await expect(page.getByRole('status').filter({hasText:'Saving debug settings…'})).toBeVisible();await expect(start).toBeDisabled();await expect(page.getByRole('button',{name:'Stop debug capture',exact:true})).toBeEnabled();
});

test('the update page hides the root and pointer cursor even before JavaScript executes',async({browser})=>{
 const server=createProgressServer({getStatus:()=>({status:'installing'}),isAppReady:async()=>false});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:1280,height:800}});
 try{
  const page=await context.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/?display=dsi-production');
  await expect(page.locator('html')).toHaveAttribute('data-tunebox-kiosk','true');
  for(const selector of ['html','body','#retry'])expect(await page.locator(selector).evaluate(node=>getComputedStyle(node).cursor)).toBe('none');
 }finally{await context.close();await new Promise(resolve=>server.close(resolve));}
});
