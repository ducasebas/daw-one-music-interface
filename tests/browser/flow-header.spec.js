import {test,expect} from '@playwright/test';
import {presets} from '../../shared/themes.js';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800},reducedMotion:'reduce'});
async function configure(page,{headerAutoHide=false,language='en',skin='reference-dark',visualizer='off',widgetPlacement='bottom'}={}){
 const token=(await(await page.request.get('/api/updates')).json()).controlToken,p=await(await page.request.get('/api/preferences')).json();
 await page.request.post('/api/preferences',{headers:{'X-TuneBox-Control':token},data:{revision:p.revision,patch:{setupCompleted:true,language,prefs:{...p.prefs,startupAnimation:'off',headerAutoHide,headerClock:true,visualizer,widgetPlacement,widgets:['clock','upnext','source']},themePreferences:{...p.themePreferences,selected:skin,mode:'manual'}}}});
}
for(const headerAutoHide of [false,true])test(`transparent spacious ${headerAutoHide?'collapsing':'fixed'} header fits every skin in both languages`,async({page})=>{
 test.setTimeout(90000);
 for(const language of ['en','nl'])for(const skin of presets){
  await configure(page,{headerAutoHide,language,skin:skin.id});await page.goto(url);const root=page.locator('.music2'),header=root.locator('>.m2-header');await expect(header).toBeVisible();
  const style=await header.evaluate(n=>{const s=getComputedStyle(n);return {height:n.getBoundingClientRect().height,background:s.backgroundColor,filter:s.backdropFilter};});expect(style.height).toBe(96);expect(style.background).toBe('rgba(0, 0, 0, 0)');expect(style.filter).toBe('none');
  const box=await header.boundingBox(),shell=await root.boundingBox();expect(box.x).toBeCloseTo(shell.x,0);expect(box.width).toBeCloseTo(shell.width,0);
  const buttons=header.locator(':scope>nav>button');await expect(buttons).toHaveCount(6);let previous=-Infinity;
  for(const button of await buttons.all()){const b=await button.boundingBox();expect(b.height).toBeGreaterThanOrEqual(80);expect(b.x).toBeGreaterThanOrEqual(previous-1);expect(b.x+b.width).toBeLessThanOrEqual(box.x+box.width);previous=b.x+b.width;const icon=await button.locator('.tb-icon').boundingBox();expect(icon.width).toBe(36);}
  const nav=await header.locator(':scope>nav').boundingBox(),clock=await header.locator('.header-clock').boundingBox();expect(nav.x+nav.width).toBeLessThanOrEqual(clock.x+1);
  const end=await header.locator(':scope>button').last().boundingBox();expect(end.x+end.width).toBeLessThanOrEqual(box.x+box.width+1);
 }
});
test('the larger header leaves every visualizer control clear of widgets in both languages and positions',async({page})=>{
 test.setTimeout(90000);
 // Include the optional video control even when a previous journey has no linked video.
 await page.route('**/api/events',route=>route.abort());
 await page.route('**/api/state',async route=>{const state=await(await page.request.get('/api/state')).json();await route.fulfill({json:{...state,videoConfigured:true}});});
 await page.route('**/api/audio?*',route=>route.fulfill({json:{configured:true,enabled:true,status:'idle',measurement:null,matchesSelected:true}}));
 for(const language of ['en','nl'])for(const headerAutoHide of [false,true])for(const widgetPlacement of ['top','bottom'])for(const visualizer of ['spectrum','meters']){
  await configure(page,{language,headerAutoHide,widgetPlacement,visualizer});await page.goto(url);const aside=page.locator('.m2-playing>aside'),controls=aside.locator('.m2-artwork-controls>button');await expect(controls).toHaveCount(3);
  const area=await aside.boundingBox(),widgets=await page.locator('.np-widgets').boundingBox();
  const plot=await aside.locator('.real-audio').boundingBox();expect(plot.width).toBeGreaterThanOrEqual(390);expect(plot.height).toBeGreaterThanOrEqual(250);
  for(const button of await controls.all()){
   const b=await button.boundingBox();expect(b.height).toBeGreaterThanOrEqual(56);expect(b.y).toBeGreaterThanOrEqual(area.y-1);expect(b.y+b.height).toBeLessThanOrEqual(area.y+area.height+1);expect(b.x+b.width).toBeLessThanOrEqual(1257);
   expect(widgetPlacement==='top'?b.y>=widgets.y+widgets.height:b.y+b.height<=widgets.y).toBe(true);
  }
 }
});
test('collapsing the larger header keeps visualizer and widgets stationary and touch targets available',async({page})=>{
 await configure(page,{headerAutoHide:true,visualizer:'spectrum'});await page.goto(url);const root=page.locator('.music2');await expect(root).toHaveAttribute('data-header','shown');
 const widgets=await page.locator('.np-widgets').boundingBox(),plot=await page.locator('.m2-playing aside').boundingBox();
 const hide=page.getByRole('button',{name:'Hide menu',exact:true}),pull=await hide.boundingBox();expect(pull.y).toBe(96);await hide.click();await expect(root).toHaveAttribute('data-header','hidden');
 const nextWidgets=await page.locator('.np-widgets').boundingBox(),nextPlot=await page.locator('.m2-playing aside').boundingBox();expect(nextWidgets.y).toBeCloseTo(widgets.y,0);expect(nextPlot.y).toBeCloseTo(plot.y,0);expect(nextPlot.height).toBeCloseTo(plot.height,0);
 await page.getByRole('button',{name:'Show menu',exact:true}).click();await expect(root).toHaveAttribute('data-header','shown');await expect(page.locator('.header-clock')).toBeVisible();
 await page.screenshot({path:'test-results/flow-header-expanded.png'});
});
