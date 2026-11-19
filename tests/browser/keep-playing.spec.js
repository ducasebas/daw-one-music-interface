import {test,expect} from '@playwright/test';
import {chooseSettingsSection} from './settings-helpers.js';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800},reducedMotion:'reduce'});
async function token(page){return (await(await page.request.get('/api/updates')).json()).controlToken;}
test.beforeEach(async({page})=>{const headers={'X-TuneBox-Control':await token(page)};await page.request.post('/api/reset',{headers,data:{kind:'preferences',confirmed:true}});const p=await(await page.request.get('/api/preferences')).json();await page.request.post('/api/preferences',{headers,data:{revision:p.revision,patch:{setupCompleted:true,prefs:{...p.prefs,startupAnimation:'off'}}}});});
test('keep the music playing is on by default and switching it on checks Music Assistant first',async({page})=>{
 let answer={ok:true,reason:'ready',providers:['Tidal','Spotify','YouTube Music'],active:false},checks=0;
 await page.route('**/api/music/keep-playing/check',r=>{checks++;return r.fulfill({json:answer});});
 await page.goto(url);await chooseSettingsSection(page,'Playback',{open:true});
 const box=page.getByLabel('Keep the music playing',{exact:true}),status=page.locator('.keep-playing-status');
 await expect(box).toBeChecked();
 await box.uncheck();await box.check();
 await expect(status).toContainText('Tidal, Spotify, YouTube Music');await expect(box).toBeChecked();expect(checks).toBe(1);
 answer={ok:false,reason:'no-similar-sources',providers:[]};
 await box.uncheck();await box.check();
 await expect(status).toContainText('none of your Music Assistant sources');await expect(box).not.toBeChecked();
 await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('[data-saved=true]')).toBeVisible();
 expect((await(await page.request.get('/api/preferences')).json()).prefs.keepPlaying).toBe(false);
});
