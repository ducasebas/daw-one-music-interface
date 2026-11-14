import {test,expect} from '@playwright/test';
import {chooseSettingsSection} from './settings-helpers.js';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800}});
const dsp={supported:true,card:'LouderRaspberry',faults:[],controls:[{id:22,name:'Equalizer',min:0,max:1,value:0,type:'ENUMERATED',options:[{value:0,label:'On'},{value:1,label:'Off'}]},{id:1,name:'00020 Hz',min:-15,max:15,value:0,type:'INTEGER'}]};
async function reset(page){const token=(await(await page.request.get('/api/updates')).json()).controlToken;await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':token},data:{kind:'preferences',confirmed:true}});await page.request.post('/api/scenario',{data:{name:'Playback'}});}

test('DSP waits for the control connection and loads automatically when the token arrives',async({page})=>{
 await reset(page);const original=await(await page.request.get('/api/updates')).json();let ready=false,reads=0;
 await page.route('**/api/updates',route=>{const value={...original,manager:{...original.manager,configured:true,progressDisplay:true}};if(!ready)delete value.controlToken;return route.fulfill({json:value});});
 await page.route('**/api/device',route=>{if(route.request().postDataJSON().command==='dsp'){reads++;return route.fulfill({json:dsp});}return route.continue();});
 await page.goto(url);await chooseSettingsSection(page,'Audio',{open:true});
 await expect(page.getByText('Connecting to the device manager…',{exact:true})).toBeVisible();expect(reads).toBe(0);await expect(page.getByText('Louder ALSA controls are unavailable.',{exact:false})).toHaveCount(0);
 ready=true;await expect(page.getByRole('checkbox',{name:'Equalizer',exact:true})).toBeChecked();expect(reads).toBe(1);
});
test('a failed amplifier read has an explicit retry and a staged EQ edit cannot be overwritten by refreshing',async({page})=>{
 await reset(page);let reads=0,writes=0;
 await page.route('**/api/device',route=>{const command=route.request().postDataJSON().command;if(command==='dsp'){reads++;return route.fulfill(reads===1?{status:503,json:{error:'Device manager temporarily unavailable.'}}:{json:dsp});}if(command==='dsp-set')writes++;return route.continue();});
 await page.goto(url);await chooseSettingsSection(page,'Audio',{open:true});await expect(page.getByRole('alert')).toContainText('Device manager temporarily unavailable.');await expect(page.getByText('Louder ALSA controls are unavailable.',{exact:false})).toHaveCount(0);
 const refresh=page.getByRole('button',{name:'Refresh amplifier controls',exact:true});await refresh.click();const eq=page.getByRole('checkbox',{name:'Equalizer',exact:true});await expect(eq).toBeChecked();expect(reads).toBe(2);
 await eq.uncheck();await expect(refresh).toBeDisabled();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(eq).toBeChecked();await expect(refresh).toBeEnabled();expect(writes).toBe(0);
});
test('unlocking an expired settings session rereads the amplifier without leaving Audio',async({page})=>{
 await reset(page);let unlocked=true,reads=0,value=dsp;
 await page.route('**/api/security/status',route=>route.fulfill({json:{enabled:true,unlocked,remainingSeconds:0}}));
 await page.route('**/api/security/unlock',route=>{unlocked=true;return route.fulfill({json:{enabled:true,unlocked:true,remainingSeconds:0}});});
 await page.route('**/api/device',route=>{if(route.request().postDataJSON().command==='dsp'){reads++;return route.fulfill({json:value});}return route.continue();});
 await page.goto(url);await chooseSettingsSection(page,'Audio',{open:true});
 await expect(page.getByRole('checkbox',{name:'Equalizer',exact:true})).toBeChecked();expect(reads).toBe(1);
 unlocked=false;
 await expect(page.getByRole('heading',{name:'Unlock settings'})).toBeVisible({timeout:20000});
 value={...dsp,controls:dsp.controls.map(c=>c.name==='Equalizer'?{...c,value:1}:c)};
 await page.getByLabel('PIN',{exact:true}).fill('572941');await page.getByRole('button',{name:'Done typing',exact:true}).click();await page.getByRole('button',{name:'Unlock',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:'Equalizer',exact:true})).not.toBeChecked();expect(reads).toBe(2);
});
