import {test,expect} from '@playwright/test';
test('production cached shell reload keeps boot telemetry unknown while offline',async({page,context})=>{
 await page.goto('/?gui=2&product=1');await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.reload();await page.getByRole('button',{name:"Open system status",exact:true}).click();
 try {
  await context.setOffline(true);
  await expect(page.getByText("Backend offline · current status unknown",{exact:true}).first()).toBeVisible({timeout:10000});
  await page.reload();await page.getByRole('button',{name:"Open system status",exact:true}).click();
  await expect(page.getByText("Startup status unavailable · check the backend",{exact:true})).toBeVisible();
  await expect(page.locator('.boot-panel [data-status="pass"]')).toHaveCount(0);
  await page.getByLabel('Boot page',{exact:true}).selectOption('3');await expect(page.getByRole('button',{name:"Save startup settings",exact:true})).toBeDisabled();
 }finally{await context.setOffline(false);}
});
