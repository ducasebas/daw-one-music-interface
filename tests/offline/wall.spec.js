import {test,expect} from '@playwright/test';
test.use({viewport:{width:1280,height:800}});
test('production wall shell and screen settings survive an offline reload',async({page})=>{
 await page.request.post('/api/scenario',{data:{name:'Playback'}});
 await page.goto('/?gui=2&screen=1&display=hdmi-development&panel=wall-16-10');
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.getByRole('button',{name:'Instellingen',exact:true}).click();await page.getByLabel('Settings page',{exact:true}).selectOption('15');
 await page.getByLabel('Schermrust weergave').selectOption('playing');
 await page.reload();await expect(page.locator('.music2')).toHaveAttribute('data-panel','wall-16-10');
 await page.context().setOffline(true);await page.reload();
 await expect(page.getByLabel('Softwareversie',{exact:true})).toHaveAttribute('data-alignment','offline');
 await page.getByRole('button',{name:'Instellingen',exact:true}).click();await page.getByLabel('Settings page',{exact:true}).selectOption('15');
 await expect(page.getByLabel('Schermrust weergave')).toHaveValue('playing');
 await page.getByLabel('Schermrust weergave').selectOption('black');await page.getByRole('button',{name:'Schermrust',exact:true}).click();
 await expect(page.getByRole('button',{name:'Scherm wekken',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Scherm wekken',exact:true}).tap();
 await expect(page.getByRole('button',{name:'Scherm wekken',exact:true})).not.toBeVisible();
 await page.context().setOffline(false);
});
