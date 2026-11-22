import {test,expect} from '@playwright/test';
import {chooseSettingsSection} from './settings-helpers.js';
const wall='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
async function prefs(page,patch){const token=(await(await page.request.get('/api/updates')).json()).controlToken;const p=await(await page.request.get('/api/preferences')).json();await page.request.post('/api/preferences',{headers:{'X-TuneBox-Control':token},data:{revision:p.revision,patch:{setupCompleted:true,prefs:{...p.prefs,startupAnimation:'off',...patch}}}});}
test.use({viewport:{width:1280,height:800}});
test.afterEach(async({page})=>prefs(page,{visualizer:'off',widgetPlacement:'bottom',widgets:['clock','upnext','source'],headerAutoHide:true}));
test('3.16: the Now Playing header slides away when idle and the tab brings it back',async({page})=>{
 await prefs(page,{headerAutoHide:true,visualizer:'off'});await page.goto(wall);
 const shell=page.locator('.music2');await expect(shell).toHaveAttribute('data-header','shown');
 await expect(shell).toHaveAttribute('data-header','hidden',{timeout:9000});
 const pull=page.getByRole('button',{name:'Show menu',exact:true});await expect(pull).toBeVisible();
 await pull.tap();await expect(shell).toHaveAttribute('data-header','shown');
 await page.locator('.m2-header').getByRole('button',{name:'Queue',exact:true}).click();await expect(shell).toHaveAttribute('data-page','queue');
 await page.waitForTimeout(6500);await expect(shell).toHaveAttribute('data-header','shown');// only Now Playing hides it
 await prefs(page,{headerAutoHide:false});await page.goto(wall);await page.waitForTimeout(6800);await expect(shell).toHaveAttribute('data-header','shown');
});
test('3.16: widgets stay above the footer with every visualizer, in either position',async({page})=>{
 for(const visualizer of ['spectrum','meters','off'])for(const widgetPlacement of ['bottom','top']){
  await prefs(page,{headerAutoHide:false,visualizer,widgetPlacement,widgets:['clock','upnext','source','power']});await page.goto(wall);
  const widgets=page.locator('.np-widgets');await expect(widgets.locator('.np-widget')).toHaveCount(4);
  const footer=await page.locator('.m2-player').boundingBox(),box=await widgets.boundingBox(),track=await page.locator('.m2-track').boundingBox();
  expect(box.y+box.height,`${visualizer}/${widgetPlacement}`).toBeLessThanOrEqual(footer.y+1);
  expect(track.y+track.height).toBeLessThanOrEqual(footer.y+1);
  if(widgetPlacement==='top')expect(box.y).toBeLessThan(track.y);else expect(box.y).toBeGreaterThan(track.y);
 }
});
test('3.16: widget order can be changed in Settings',async({page})=>{
 await prefs(page,{widgets:['clock','upnext','source']});await page.goto(wall);
 await chooseSettingsSection(page,'Display',{open:true});
 await page.getByRole('button',{name:'Move right: Clock',exact:true}).click();
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect.poll(async()=>(await(await page.request.get('/api/preferences')).json()).prefs.widgets).toEqual(['upnext','clock','source']);
 await page.getByRole('combobox',{name:'Widget position',exact:true}).selectOption('top');await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect.poll(async()=>(await(await page.request.get('/api/preferences')).json()).prefs.widgetPlacement).toBe('top');
});
