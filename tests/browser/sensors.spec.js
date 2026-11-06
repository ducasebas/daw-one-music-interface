import {test,expect} from '@playwright/test';
test('sensor readouts are distinct from simulation and become unknown offline',async({page,context})=>{
 const state=await(await page.request.get('/api/state')).json();
 state.hardwareTelemetry={enabled:true,temperature:{status:'ok',value:19.5},light:{status:'ok',value:485.74848},amplifierVerified:false};
 await page.route('**/api/state',r=>r.fulfill({json:state}));
 await page.route('**/api/events',r=>r.fulfill({contentType:'text/event-stream',body:`data: ${JSON.stringify(state)}\n\n`}));
 await page.goto('/?gui=2&product=1');await page.getByRole('button',{name:'Open opstartcontrole',exact:true}).click();
 await expect(page.getByLabel('Echte sensormetingen')).toContainText('19.5');await expect(page.getByLabel('Echte sensormetingen')).toContainText('485.7');
 for(let i=0;i<3;i++){await page.getByLabel('Boot page',{exact:true}).selectOption(String(i));expect(await page.locator('.boot-panel .page-body').evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);}
 try{await page.route("**/api/**",r=>r.abort());await context.setOffline(true);await expect(page.getByLabel('Echte sensormetingen')).toContainText('onbekend',{timeout:10000});}finally{await context.setOffline(false);}
});
