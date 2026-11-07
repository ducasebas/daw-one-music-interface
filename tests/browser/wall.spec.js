import {test,expect} from '@playwright/test';
import {presets} from '../../shared/themes.js';
const url='/?gui=2&screen=1&display=hdmi-development&panel=wall-16-10';
test.use({viewport:{width:1280,height:800}});
test.beforeEach(async({page})=>{await page.request.post('/api/scenario',{data:{name:'Playback'}});await page.goto(url);});
test('wall geometry, six skins and all top-level flows fit without document scrolling',async({page})=>{
 for(const name of ['Ontdek','Mijn muziek','Zoeken','Wachtrij','Kamers','Instellingen']){
  await page.getByRole('button',{name,exact:true}).click();
  expect(await page.locator('.music2').boundingBox()).toMatchObject({width:1280,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBe(800);
 }
 for(const {id} of presets){
  await page.getByLabel('Settings page',{exact:true}).selectOption('1');
  await page.getByLabel('Skin',{exact:true}).selectOption(id);
  await expect(page.locator('.music2')).toHaveAttribute('data-theme',id);
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.getByRole('button',{name:'Open Nu spelen',exact:true}).click();
 const play=await page.locator('.m2-play').boundingBox();expect(play.width).toBeGreaterThanOrEqual(64);expect(play.height).toBeGreaterThanOrEqual(64);
 await page.getByRole('button',{name:'Instellingen',exact:true}).click();await page.getByLabel('Settings page',{exact:true}).selectOption('1');await page.getByLabel('Skin',{exact:true}).selectOption('warm-bronze');
 await page.getByRole('button',{name:'Open Nu spelen',exact:true}).click();
 await page.screenshot({path:'test-results/wall-playing.png'});
});
test('notifications navigate all six categories and restore focus; offline settings persist',async({page})=>{
 await page.getByRole('button',{name:'Meldingen',exact:true}).click();
 const tray=page.getByRole('dialog',{name:'Meldingenpaneel'});
 for(const name of ['Systeemrapport','Update','Hardware alert','Newsletter','What’s new','Tutorial']){
  await tray.getByRole('button',{name,exact:true}).click();await expect(tray.getByRole('heading',{name,exact:true})).toBeVisible();
 }
 await page.keyboard.press('Escape');await expect(tray).not.toBeVisible();await expect(page.getByRole('button',{name:'Meldingen',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Instellingen',exact:true}).click();await page.getByLabel('Settings page',{exact:true}).selectOption('15');
 await page.getByLabel('Schermrust weergave').selectOption('widgets');await page.reload();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('daw-settings')).screen.mode)).toBe('widgets');
 await page.context().setOffline(true);
 await expect(page.getByLabel('Softwareversie',{exact:true})).toHaveAttribute('data-alignment','offline');
 await page.getByRole('button',{name:'Instellingen',exact:true}).click();await page.getByLabel('Settings page',{exact:true}).selectOption('15');
 await page.getByLabel('Schermrust weergave').selectOption('glow');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('daw-settings')).screen.mode)).toBe('glow');
 await page.context().setOffline(false);
});
test('all sleep views wake with one touch without pausing playback; black really paints black',async({page})=>{
 await page.getByRole('button',{name:'Instellingen',exact:true}).click();await page.getByLabel('Settings page',{exact:true}).selectOption('15');
 for(const mode of ['clock','widgets','sunset','glow','playing','black']){
  await page.getByLabel('Schermrust weergave').selectOption(mode);
  const before=await(await page.request.get('/api/state')).json();
  await page.getByRole('button',{name:'Schermrust',exact:true}).click();
  const sleep=page.getByRole('button',{name:'Scherm wekken',exact:true});await expect(sleep).toHaveAttribute('data-mode',mode);
  if(mode==='black')expect(await sleep.innerText()).toBe('');
  expect((await(await page.request.get('/api/state')).json()).playback.playing).toBe(before.playback.playing);
  await sleep.tap();await expect(sleep).not.toBeVisible();
  await expect(page.getByLabel('Schermrust weergave')).toBeVisible();
 }
});

test('critical faults remain visible in black rest; display wake never clears a fault',async({page})=>{
 await page.getByRole('button',{name:'Instellingen',exact:true}).click();await page.getByLabel('Settings page',{exact:true}).selectOption('15');
 await page.getByLabel('Schermrust weergave').selectOption('black');await page.getByRole('button',{name:'Schermrust',exact:true}).click();
 await page.request.post('/api/event',{data:{type:'thermal-alarm'}});
 await expect(page.locator('.sleep-fault')).toContainText('thermal-alarm');
 await page.getByRole('button',{name:'Scherm wekken',exact:true}).tap();
 await expect(page.getByRole('button',{name:'Scherm wekken',exact:true})).not.toBeVisible();
 const s=await(await page.request.get('/api/state')).json();expect(s.device.amplifierEnabled).toBe(false);expect(s.device.faults).toContain('thermal-alarm');
});

test('wall test bench keeps the same panel aspect and shared playback',async({page})=>{
 await page.goto('/?gui=2&lab=1&panel=wall-16-10');
 const frame=page.locator('.bench-screen');const box=await frame.boundingBox();
 expect(Math.abs(box.height/box.width-.625)).toBeLessThan(.025);
 await expect(page.locator('.music2')).toHaveAttribute('data-panel','wall-16-10');
 const state=await(await page.request.get('/api/state')).json();
 await expect(page.locator('.m2-current')).toContainText(state.playback.queue[state.playback.index].title);
});
