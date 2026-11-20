import {test,expect,devices} from '@playwright/test';
import {remoteView} from '../../server/remote-control.js';
const shot=async(page,name)=>{if(process.env.TUNEBOX_SHOTS)await page.screenshot({path:process.env.TUNEBOX_SHOTS+'/'+name+'.png'});};
test('the phone shows TuneBox notifications, can dismiss them, and invites another phone with a QR code',async({browser})=>{
 const ctx=await browser.newContext({...devices['iPhone 13'],browserName:undefined,defaultBrowserType:undefined,baseURL:'http://127.0.0.1:5173'});const page=await ctx.newPage();
 const view=remoteView({mode:'music-assistant',musicAssistant:{status:'connected',volumeLimit:40},playback:{connected:true,playing:true,volume:20,index:0,queue:[{title:'Song',artist:'Artist',duration:200}]}},{notifications:[{id:'update',title:'Update available',detail:'2026.11.20-hotfix.2'},{id:'music',title:'Check Music Assistant',detail:'The music server is not reachable.'}]});
 let invites=0;
 await page.route('**/api/remote/session',r=>r.fulfill({json:{paired:true}}));
 await page.route('**/api/remote/events',r=>r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify(view)+'\n\n'}));
 await page.route('**/api/remote/invite',r=>{invites++;return r.fulfill({json:{url:'http://192.168.1.20:3003/remote.html#pair='+'b'.repeat(48),expiresAt:Date.now()+600000,pinRequired:true}});});
 await page.goto('/remote.html');
 const notes=page.getByRole('region',{name:'TuneBox notifications'});await expect(notes.getByText('Update available')).toBeVisible();await expect(notes.getByText('The music server is not reachable.')).toBeVisible();
 await shot(page,'remote-notifications');
 await notes.locator('article').filter({hasText:'Update available'}).getByRole('button',{name:'Dismiss'}).click();await expect(notes.getByText('Update available')).toHaveCount(0);
 await page.reload();await expect(page.getByRole('region',{name:'TuneBox notifications'}).getByText('Check Music Assistant')).toBeVisible();await expect(page.getByText('Update available')).toHaveCount(0);
 await page.getByRole('button',{name:'Invite a phone'}).click();expect(invites).toBe(1);
 const sheet=page.getByRole('dialog',{name:'Invite a phone'});await expect(sheet.getByRole('img',{name:'Invitation QR code'}).locator('svg')).toBeVisible();
 await expect(sheet.getByText('The other phone also needs the TuneBox settings PIN.')).toBeVisible();await expect(sheet.getByText('#pair=bbbb',{exact:false})).toBeVisible();
 // Like a phone on the LAN: the clipboard API refuses, the classic copy still works.
 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('denied'))}});document.execCommand=()=>true;});
 await sheet.getByRole('button',{name:'Copy link'}).click();await expect(sheet.getByRole('button',{name:'Link copied'})).toBeVisible();
 // When both refuse, the link stays visible with an honest hint.
 await page.evaluate(()=>{document.execCommand=()=>false;});await sheet.getByRole('button',{name:'Link copied'}).click();await expect(sheet.getByText('Copy the link by hand.')).toBeVisible();
 await shot(page,'remote-invite');await ctx.close();
});
