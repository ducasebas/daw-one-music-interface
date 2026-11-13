import {test,expect} from '@playwright/test';
import {createProgressServer} from '../../deploy/manager/progress-server.mjs';
async function openUpdates(page){await page.goto('/?gui=2&product=1');await page.getByRole('button',{name:"Settings",exact:true}).click();await page.getByLabel('Settings page',{exact:true}).selectOption('12');}
test('Updates settings shows channel information and fits without overflow',async({page})=>{
 await page.route('**/api/updates',route=>route.fulfill({json:{status:'waiting-idle',channel:'preview',commit:'a'.repeat(40),checkedAt:new Date().toISOString()}}));
 await openUpdates(page);await expect(page.getByRole('heading',{name:'Software updates'})).toBeVisible();await expect(page.getByText("Waiting for playback to stop",{exact:true})).toBeVisible();await expect(page.getByText('Channel: preview',{exact:false})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBe(400);
});
test('simulation checks, installs with progress and rolls back using the shared manager',async({page})=>{
 await page.request.post('/api/scenario',{data:{name:'Cold boot'}});await openUpdates(page);
 await page.getByRole('button',{name:"Check for updates",exact:true}).click();await expect(page.getByText("Available:",{exact:false})).toContainText('-preview');
 await page.getByLabel('Updates page',{exact:true}).selectOption('1');await page.getByLabel("Update policy",{exact:true}).selectOption('notify');await page.getByRole('button',{name:"Save update policy"}).click();await expect(page.getByRole('status').filter({hasText:"Saved"})).toBeVisible();
 await page.getByLabel('Updates page',{exact:true}).selectOption('0');await page.getByRole('button',{name:"Install update",exact:true}).click();
 await expect(page.getByRole('progressbar',{name:"Update progress"}).first()).toBeVisible();await expect(page.getByRole('heading',{name:"Update complete",exact:true})).toBeVisible({timeout:15000});
 await page.getByRole('button',{name:"Previous version…",exact:true}).click();await page.getByRole('button',{name:"Confirm rollback",exact:true}).click();await expect(page.getByRole('heading',{name:"Previous version restored",exact:true})).toBeVisible({timeout:15000});
 const info=await(await page.request.get('/api/updates')).json();expect(info.manager.policy.mode).toBe('paused');expect(info.manager.simulated).toBe(true);expect((await(await page.request.get('/api/state')).json()).device.amplifierEnabled).toBe(false);
});
test('first-run wizard fits each page and tests simulated server/player without storing the token',async({page})=>{
 await page.request.post('/api/scenario',{data:{name:'Cold boot'}});await page.goto('/?gui=2&product=1');await page.getByRole('button',{name:"Settings",exact:true}).click();await page.getByLabel('Settings page',{exact:true}).selectOption('13');
 for(let i=0;i<6;i++){await page.getByLabel('Setup page',{exact:true}).selectOption(String(i));expect(await page.locator('.setup-wizard .page-body').evaluate(e=>e.scrollHeight<=e.clientHeight+1)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBe(400);}
 await page.getByLabel('Setup page',{exact:true}).selectOption('0');await page.getByRole('button',{name:"Check network",exact:true}).click();await expect(page.getByText("Simulated network connection",{exact:true})).toBeVisible();
 await page.getByLabel('Setup page',{exact:true}).selectOption('1');await page.getByLabel('Music Assistant server address',{exact:true}).fill('http://localhost:8095');await page.getByLabel('Music Assistant access token',{exact:true}).fill('test-secret-never-store');await page.getByRole('button',{name:"Test connection",exact:true}).click();await expect(page.getByLabel('Setup page',{exact:true})).toHaveValue('2');await page.getByLabel("Player setup",{exact:true}).selectOption('simulated-tunebox');await page.getByRole('button',{name:"Save server and player",exact:true}).click();await expect(page.getByText("Simulated · device configuration and audio stay unchanged",{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.stringify({...localStorage}))).not.toContain('test-secret-never-store');await page.getByLabel('Setup page',{exact:true}).selectOption('1');await expect(page.getByLabel('Music Assistant access token',{exact:true})).toHaveValue('');
 await page.getByLabel('Setup page',{exact:true}).selectOption('5');await page.getByRole('button',{name:"Finish setup",exact:true}).click();
});
test('offline update controls do not reuse cached authority',async({page})=>{
 await page.route('**/api/updates',route=>route.abort());await openUpdates(page);await expect(page.getByRole('button',{name:"Check for updates",exact:true})).toBeDisabled();await expect(page.getByText("Offline · device changes are unavailable",{exact:true})).toBeVisible();
});
test('independent update page stays visible while backend is unavailable',async({page})=>{
 let status={status:'downloading',percent:35,commit:'a'.repeat(40)};
 const server=createProgressServer({getStatus:()=>status,isAppReady:async()=>false});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{await page.goto('http://127.0.0.1:'+server.address().port+'/?display=dsi-production');await expect(page.getByRole('progressbar',{name:"Update progress"})).toHaveJSProperty('value',0.35);expect(await page.locator('h1').evaluate(e=>getComputedStyle(e).userSelect)).toBe('none');status={...status,status:'checking-health',percent:null};await expect(page.getByRole('heading',{name:'Checking the new version',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBe(400);await page.screenshot({path:'test-results/update-independent.png'});}finally{await new Promise(r=>server.close(r));}
});
