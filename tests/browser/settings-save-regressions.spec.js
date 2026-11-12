import {test,expect} from '@playwright/test';
import {presets} from '../../shared/themes.js';
import {translate} from '../../shared/i18n.js';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800},reducedMotion:'reduce'});
async function token(page){return (await(await page.request.get('/api/updates')).json()).controlToken;}
async function post(page,path,data){return page.request.post(path,{headers:{'X-TuneBox-Control':await token(page)},data});}
async function open(page,name){await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('navigation',{name:'Settings categories'}).getByRole('button',{name,exact:true}).click();}
test.beforeEach(async({page})=>{
 await post(page,'/api/reset',{kind:'preferences',confirmed:true});
 const settings=await(await page.request.get('/api/preferences')).json();
 await post(page,'/api/preferences',{revision:settings.revision,patch:{prefs:{...settings.prefs,startupAnimation:'off'}}});
 await post(page,'/api/device',{command:'policy',args:{mode:'notify',windowEnabled:false,start:'02:00',end:'05:00',timeZone:'Europe/Amsterdam'}});
 await page.request.post('/api/scenario',{data:{name:'Playback'}});await page.goto(url);
});
test('the update-window checkbox uses the common Save/Cancel bar and survives reopening',async({page})=>{
 await open(page,'Updates');await page.getByLabel('Updates page',{exact:true}).selectOption('1');
 const checkbox=page.getByLabel('Only within the time window',{exact:false}),save=page.getByRole('button',{name:'Save',exact:true});
 await expect(save).toBeDisabled();await checkbox.check();await expect(save).toBeEnabled();await save.click();await expect(page.locator('[data-saved=true]')).toBeVisible();await expect(save).toBeDisabled();
 expect((await(await page.request.get('/api/updates')).json()).manager.policy.windowEnabled).toBe(true);
 await checkbox.uncheck();await expect(save).toBeEnabled();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(checkbox).toBeChecked();await expect(save).toBeDisabled();
 await page.reload();await open(page,'Updates');await page.getByLabel('Updates page',{exact:true}).selectOption('1');await expect(checkbox).toBeChecked();
});
test('developer update edits also use Save and cannot disappear when changing developer topic',async({page})=>{
 await open(page,'Developer');const topics=page.getByRole('navigation',{name:'Developer topics'});await topics.getByRole('button',{name:'Updates',exact:true}).click();await page.getByLabel('Updates page',{exact:true}).selectOption('1');
 await page.getByLabel('Only within the time window',{exact:false}).check();await expect(page.getByRole('button',{name:'Save',exact:true})).toBeEnabled();
 await topics.getByRole('button',{name:'Status',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Unsaved changes'});await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Save and continue',exact:true}).click();await expect(dialog).not.toBeVisible();await expect(page.locator('.system-dashboard')).toBeVisible();
 expect((await(await page.request.get('/api/updates')).json()).manager.policy.windowEnabled).toBe(true);
});
test('each date and time checkbox enables Save on its own without changing an unrelated clock value',async({page})=>{
 await open(page,'Date & time');const save=page.getByRole('button',{name:'Save',exact:true});await expect(save).toBeDisabled();
 for(const name of ['Automatic date and time','12-hour clock']){
  const checkbox=page.getByLabel(name,{exact:true});const old=await checkbox.isChecked();await checkbox.setChecked(!old);await expect(save).toBeEnabled();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(checkbox).toBeChecked({checked:old});await expect(save).toBeDisabled();
 }
});
test('audio master and automatic brightness checkbox edits enable the central Save action',async({page})=>{
 await page.route('**/api/audio?watch=1',r=>r.fulfill({json:{configured:true,enabled:false,status:'disabled',measurement:null}}));
 await page.route('**/api/display',async r=>{const response=await r.fetch();const value=await response.json();await r.fulfill({json:{...value,backlight:{supported:true}}});});
 await open(page,'Audio');const save=page.getByRole('button',{name:'Save',exact:true});await expect(save).toBeDisabled();await page.getByLabel('Enable audio analysis',{exact:true}).check();await expect(save).toBeEnabled();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(save).toBeDisabled();
 await page.getByRole('navigation',{name:'Settings categories'}).getByRole('button',{name:'Display',exact:true}).click();await page.getByLabel('Automatic brightness',{exact:true}).check();await expect(save).toBeEnabled();await save.click();await expect(page.locator('[data-saved=true]')).toBeVisible();expect((await(await page.request.get('/api/preferences')).json()).display.brightnessMode).toBe('auto');
});
test('Dutch topic tiles and saved feedback fit all six skins',async({page})=>{
 test.setTimeout(90000);
 for(const {id} of presets){
  const settings=await(await page.request.get('/api/preferences')).json();await post(page,'/api/preferences',{revision:settings.revision,patch:{language:'nl',themePreferences:{...settings.themePreferences,selected:id,mode:'manual'}}});await page.reload();
  await page.getByRole('button',{name:'Instellingen',exact:true}).click();const nav=page.getByRole('navigation',{name:translate('Settings categories','nl')});
  for(const button of await nav.getByRole('button').all()){
   await expect(button).toBeInViewport();expect(await button.evaluate(e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1)).toBe(true);
  }
  await nav.getByRole('button',{name:translate('Presence','nl'),exact:true}).click();await page.getByLabel(translate('Night schedule','nl'),{exact:true}).check();await page.getByRole('button',{name:'Opslaan',exact:true}).click();const feedback=page.locator('[data-saved=true]');await expect(feedback).toBeVisible();
  const outer=await feedback.boundingBox(),icon=await feedback.locator('svg').boundingBox();expect(icon.y).toBeGreaterThanOrEqual(outer.y);expect(icon.y+icon.height).toBeLessThanOrEqual(outer.y+outer.height);
  await page.getByLabel(translate('Night schedule','nl'),{exact:true}).uncheck();await page.getByRole('button',{name:'Opslaan',exact:true}).click();await expect(page.getByRole('button',{name:translate('Open Now Playing','nl'),exact:true})).toBeInViewport();
 }
});
