import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
// 3.16.3: the independent update page keeps its clock running and explains a lost connection instead of freezing.
const html=readFileSync('deploy/manager/progress.html','utf8').replaceAll('__TUNEBOX_FRAME_TOKEN__','x').replace('__TUNEBOX_DISPLAY_ATTRIBUTE__','data-tunebox-kiosk="true"');
test('the update page keeps counting and offers a way back when the update service stops answering',async({page})=>{
 let up=true;const started=new Date(Date.now()-90000).toISOString();
 await page.route('http://tunebox.test/**',route=>{const path=new URL(route.request().url()).pathname;
  if(path==='/')return route.fulfill({contentType:'text/html',body:html});
  if(path==='/status')return up?route.fulfill({json:{status:'installing',startedAt:started,typicalSeconds:118,available:{label:'GUI 9.9.9 · TEST',notes:'Test notes.'}}}):route.abort();
  return route.fulfill({status:204,body:''});});
 await page.clock.install();
 await page.goto('http://tunebox.test/?display=dsi-production&panel=wall-16-10');
 await expect(page.locator('#phase')).toHaveText('Installing update');await expect(page.locator('#time')).toContainText('Elapsed 1:3');
 up=false;await page.clock.runFor(10000);
 await expect(page.locator('#phase')).toHaveText('Installing update');await expect(page.locator('#time')).toContainText('Elapsed 1:4');
 await page.clock.runFor(15000);
 await expect(page.locator('#phase')).toHaveText('No contact with the update service');await expect(page.locator('#hint')).toContainText('do not switch it off');await expect(page.locator('#retry')).toBeHidden();
 await page.clock.runFor(170000);
 await expect(page.locator('#hint')).toContainText('returns to the previous version by itself');await expect(page.locator('#retry')).toHaveText('Back to TuneBox');await expect(page.locator('#retry')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.dataset.tuneboxKiosk)).toBe('true');
 up=true;await page.clock.runFor(2000);await expect(page.locator('#phase')).toHaveText('Installing update');await expect(page.locator('#retry')).toBeHidden();
});
