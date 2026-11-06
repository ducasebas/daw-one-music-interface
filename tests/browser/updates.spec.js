import {test,expect} from '@playwright/test';
test('Updates settings shows read-only channel information without overflow',async({page})=>{
 await page.route('**/api/updates',route=>route.fulfill({json:{status:'waiting-idle',channel:'preview',commit:'a'.repeat(40),checkedAt:new Date().toISOString()}}));
 await page.goto('/?gui=2&product=1');
 await page.getByRole('button',{name:'Instellingen',exact:true}).click();
 await page.getByLabel('Settings page',{exact:true}).selectOption('12');
 await expect(page.getByRole('heading',{name:'Software updates'})).toBeVisible();
 await expect(page.getByText('waiting-idle',{exact:true})).toBeVisible();
 await expect(page.getByText('Channel: preview',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBe(400);
});
