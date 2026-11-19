import {test,expect} from '@playwright/test';
import {release,releaseTitle} from '../../shared/release.js';
import {chooseDeveloperTopic} from './settings-helpers.js';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800},reducedMotion:'reduce'});
async function token(page){return (await(await page.request.get('/api/updates')).json()).controlToken;}
async function preferences(page,patch){const headers={'X-TuneBox-Control':await token(page)};const saved=await(await page.request.get('/api/preferences')).json();await page.request.post('/api/preferences',{headers,data:{revision:saved.revision,patch:{...patch,prefs:{...saved.prefs,startupAnimation:'off',...(patch.prefs||{})}}}});}
test.beforeEach(async({page})=>{
 await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':await token(page)},data:{kind:'preferences',confirmed:true}});
 await preferences(page,{});await page.request.post('/api/scenario',{data:{name:'Playback'}});
});
test.afterAll(async({request})=>{const t=(await(await request.get('/api/updates')).json()).controlToken;await request.post('/api/reset',{headers:{'X-TuneBox-Control':t},data:{kind:'preferences',confirmed:true}});});

test('the startup screen names the update and its version',async({page})=>{
 await preferences(page,{prefs:{startupAnimation:'still'}});await page.goto(url);
 const title=page.locator('.startup-release');await expect(title).toHaveText(releaseTitle(release));await expect(title).toHaveText(/^\S.* · GUI \d+\.\d+\.\d+$/);
 await page.screenshot({path:'test-results/polish-startup.png'});
});
test('wizards use the active skin colours, font and radius',async({page})=>{
 const saved=await(await page.request.get('/api/preferences')).json();
 // GUI 3.11.1: the skin's own font applies when "Skin font" is chosen; Inter is the default.
 await preferences(page,{themePreferences:{...saved.themePreferences,selected:'warm-bronze',mode:'manual'},prefs:{font:'skin'}});
 await page.goto(url);await page.locator('.m2-header').getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('navigation',{name:'Settings categories'}).getByRole('button',{name:'Connections',exact:true}).click();
 await page.locator('.setup-cards button').filter({hasText:'Music Assistant'}).first().click();
 const wizard=page.getByRole('dialog',{name:'Music Assistant setup',exact:true});await expect(wizard).toBeVisible();
 const style=await wizard.evaluate(e=>{const cs=getComputedStyle(e),step=getComputedStyle(e.querySelector('.journey-steps [aria-current=step]'));return {bg:cs.backgroundColor,font:cs.fontFamily,accent:step.borderTopColor,radius:parseFloat(step.borderTopLeftRadius)};});
 expect(style.bg).toBe('rgb(27, 21, 18)');expect(style.accent).toBe('rgb(197, 139, 92)');expect(style.font).toMatch(/Georgia/);expect(style.radius).toBe(14);
 await page.screenshot({path:'test-results/polish-wizard-bronze.png'});
});
test('the Music Assistant wizard shows the saved address and player while the connection is down, never the token',async({page})=>{
 const state=await(await page.request.get('/api/state')).json();
 Object.assign(state,{mode:'music-assistant',musicAssistant:{connected:false,status:'disconnected',playerId:'tunebox-pi',serverUrl:'http://music.local:8095',controlEnabled:true,volumeLimit:40,players:[]}});
 state.playback={...state.playback,connected:false};
 await page.route('**/api/events',r=>r.abort());await page.route('**/api/state',r=>r.fulfill({json:state}));
 await page.route('**/api/device',async r=>{const body=r.request().postDataJSON();if(body.command==='probe-music')return r.fulfill({json:{players:[{id:'other',name:'Kitchen',available:true},{id:'tunebox-pi',name:'TuneBox',available:true}]}});return r.continue();});
 await page.goto(url);await page.locator('.m2-header').getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('navigation',{name:'Settings categories'}).getByRole('button',{name:'Connections',exact:true}).click();
 await page.locator('.setup-cards button').filter({hasText:'Music Assistant'}).first().click();
 const wizard=page.getByRole('dialog',{name:'Music Assistant setup',exact:true});
 await expect(wizard.getByLabel('Music Assistant server address',{exact:true})).toHaveValue('http://music.local:8095');
 await expect(wizard.getByLabel('Music Assistant access token',{exact:true})).toHaveValue('');
 await wizard.getByRole('button',{name:'Test connection',exact:true}).click();
 await expect(wizard.getByRole('button',{name:'TuneBox',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(wizard.getByRole('checkbox')).toBeChecked();
});
test('Developer → Services offers a confirmed service restart and a reboot that waits for silence',async({page})=>{
 const posts=[];page.on('request',r=>{if(r.url().endsWith('/api/device')&&r.method()==='POST')posts.push(r.postDataJSON().command);});
 await page.goto(url);await chooseDeveloperTopic(page,'Services',{open:true});
 const reboot=page.getByRole('button',{name:'Reboot TuneBox',exact:true}),service=page.getByRole('button',{name:'Restart TuneBox service',exact:true});
 // Music is playing in this scenario: a reboot is not offered until it is paused.
 await expect(reboot).toBeDisabled();await expect(page.getByText('Pause the music to reboot.',{exact:false})).toBeVisible();
 await service.click();const dialog=page.getByRole('dialog',{name:'Restart the TuneBox service?',exact:true});await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).not.toBeVisible();expect(posts.filter(c=>['reboot','restart-service'].includes(c))).toEqual([]);
 await service.click();await dialog.getByRole('button',{name:'Restart service',exact:true}).click();
 await expect(page.locator('.restart-controls [role=status]')).toHaveText('Simulation — nothing will be restarted.');expect(posts).toContain('restart-service');
 await page.request.post('/api/event',{data:{type:'pause'}});await expect(reboot).toBeEnabled();
 await reboot.click();const confirm=page.getByRole('dialog',{name:'Restart TuneBox?',exact:true});await confirm.getByRole('button',{name:'Restart TuneBox',exact:true}).click();
 await expect.poll(()=>posts.includes('reboot')).toBe(true);await expect(confirm).not.toBeVisible();
 await page.screenshot({path:'test-results/polish-restart.png'});
});
