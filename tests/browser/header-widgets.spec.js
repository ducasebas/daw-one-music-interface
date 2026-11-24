import {test,expect} from '@playwright/test';
import {chooseSettingsSection} from './settings-helpers.js';
const wall='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
async function prefs(page,patch){const token=(await(await page.request.get('/api/updates')).json()).controlToken;const p=await(await page.request.get('/api/preferences')).json();await page.request.post('/api/preferences',{headers:{'X-TuneBox-Control':token},data:{revision:p.revision,patch:{setupCompleted:true,prefs:{...p.prefs,startupAnimation:'off',...patch}}}});}
test.use({viewport:{width:1280,height:800}});
test.afterEach(async({page})=>prefs(page,{visualizer:'off',widgetPlacement:'bottom',widgets:['clock','upnext','source'],restWidgets:['temperature','light','sunset'],headerAutoHide:true}));
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
 await page.getByRole('button',{name:'Choose widgets: Now Playing widgets',exact:true}).click();
 await page.getByRole('button',{name:'Move right: Clock',exact:true}).click();await page.getByRole('button',{name:'Apply selection',exact:true}).click();
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect.poll(async()=>(await(await page.request.get('/api/preferences')).json()).prefs.widgets).toEqual(['upnext','clock','source']);
 await page.getByRole('combobox',{name:'Widget position',exact:true}).selectOption('top');await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect.poll(async()=>(await(await page.request.get('/api/preferences')).json()).prefs.widgetPlacement).toBe('top');
});
for(const navigateDuringSave of [false,true])test('a late Save response preserves newer widget edits'+(navigateDuringSave?' and queued navigation asks before leaving':''),async({page})=>{
 await prefs(page,{widgets:['clock','upnext','source'],widgetPlacement:'bottom'});await page.goto(wall);
 await chooseSettingsSection(page,'Display',{open:true});
 await page.getByRole('button',{name:'Choose widgets: Now Playing widgets',exact:true}).click();
 await page.getByRole('button',{name:'Move right: Clock',exact:true}).click();await page.getByRole('button',{name:'Apply selection',exact:true}).click();
 let stored=false,first=true,release;const hold=new Promise(resolve=>{release=resolve;});
 await page.route('**/api/preferences',async route=>{
  if(route.request().method()!=='POST'||!first)return route.continue();first=false;
  const response=await route.fetch();stored=true;await hold;await route.fulfill({response});
 });
 try{
  await page.getByRole('button',{name:'Save',exact:true}).click();await expect.poll(()=>stored).toBe(true);
  await expect(page.getByRole('button',{name:'Saving…',exact:true})).toBeDisabled();
  const position=page.getByRole('combobox',{name:'Widget position',exact:true});await position.selectOption('top');
  if(navigateDuringSave)await page.getByRole('button',{name:'All settings',exact:true}).click();
  release();await expect(page.getByRole('button',{name:'Saving…',exact:true})).not.toBeVisible();
  if(navigateDuringSave){const dialog=page.getByRole('dialog',{name:'Unsaved changes',exact:true});await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Stay here',exact:true}).click();}
  await expect(position).toHaveValue('top');await expect(page.locator('.hub-savebar')).toContainText('Unsaved changes');
  await expect(page.locator('.hub-savebar [data-saved=true]')).toHaveCount(0);
  await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('.hub-savebar [data-saved=true]')).toBeVisible();
  const saved=await(await page.request.get('/api/preferences')).json();expect(saved.prefs.widgets).toEqual(['upnext','clock','source']);expect(saved.prefs.widgetPlacement).toBe('top');
 }finally{release();}
});
test('3.16: Developer → Values reads the timing and power values without changing them',async({page})=>{
 await page.goto(wall);
 const {chooseDeveloperTopic}=await import('./settings-helpers.js');await chooseDeveloperTopic(page,'Values',{open:true});
 const values=page.locator('.developer-values');await expect(values).toContainText('In use: screen delay');await expect(values).toContainText('Contract now');
 await expect(values).toContainText('Reference timing for new TuneBoxes');await values.getByRole('button',{name:'Read again',exact:true}).click();await expect(values).toContainText('Offered by the supply');
});
test('3.16.2: widgets are dragged from the shelf onto a place, and rest widgets are chosen the same way',async({page})=>{
 await prefs(page,{widgets:['clock','upnext','source'],restWidgets:['temperature','light','sunset']});await page.goto(wall);
 await chooseSettingsSection(page,'Display',{open:true});
 await page.getByRole('button',{name:'Choose widgets: Now Playing widgets',exact:true}).click();const editor=page.locator('.widget-editor');
 // Every unused widget shows a preview; unavailable ones are marked as a demo.
 await expect(editor.locator('.we-shelf-item')).toHaveCount(7);await expect(editor.locator('.we-shelf-item .we-demo').first()).toBeVisible();
 const from=await editor.getByRole('button',{name:'Drag widget: Wi-Fi',exact:true}).boundingBox(),to=await editor.locator('.we-slots>li').nth(3).boundingBox();
 await page.mouse.move(from.x+30,from.y+20);await page.mouse.down();await page.mouse.move(from.x+50,from.y+10,{steps:3});await page.mouse.move(to.x+40,to.y+40,{steps:8});
 await expect(editor.locator('.we-slots>li').nth(3)).toHaveAttribute('data-over','true');await page.mouse.up();
 await expect(editor.locator('.we-slots>li').nth(3)).toContainText('Wi-Fi');
 await page.getByRole('button',{name:'Apply selection',exact:true}).click();await page.getByRole('button',{name:'Choose widgets: Screen rest widgets',exact:true}).click();const rest=page.locator('.widget-editor');await rest.getByRole('button',{name:'Remove: Sunset',exact:true}).click();await rest.getByRole('button',{name:'Add Clock',exact:true}).click();await page.getByRole('button',{name:'Apply selection',exact:true}).click();
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect.poll(async()=>(await(await page.request.get('/api/preferences')).json()).prefs.widgets).toEqual(['clock','upnext','source','wifi']);
 await expect.poll(async()=>(await(await page.request.get('/api/preferences')).json()).prefs.restWidgets).toEqual(['temperature','light','clock']);
 // The rest view shows the chosen rest widgets.
 const p=await(await page.request.get('/api/preferences')).json();const token=(await(await page.request.get('/api/updates')).json()).controlToken;
 await page.request.post('/api/preferences',{headers:{'X-TuneBox-Control':token},data:{revision:p.revision,patch:{prefs:{...p.prefs,screen:{...p.prefs.screen,mode:'widgets'}}}}});
 await page.goto(wall);await page.getByRole('button',{name:'Screen rest',exact:true}).click();
 await expect(page.locator('.sleep-widgets [data-widget]')).toHaveCount(3);await expect(page.locator('.sleep-widgets [data-widget=clock]')).toBeVisible();
});
