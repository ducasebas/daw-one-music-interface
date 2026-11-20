import {chooseSettingsSection} from './settings-helpers.js';
import {test,expect} from '@playwright/test';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800}});
const shot=async(page,name)=>{if(process.env.TUNEBOX_SHOTS)await page.screenshot({path:process.env.TUNEBOX_SHOTS+'/'+name+'.png'});};
async function openBluetooth(page,state){
 await page.route('**/api/bluetooth',route=>route.fulfill({json:state}));
 await page.goto(url);await chooseSettingsSection(page,'Connections',{open:true});
 await page.locator('.hub-section[data-section="connections"] .hub-tabs').getByRole('button',{name:'Bluetooth',exact:true}).click();
}
test('Bluetooth explains the setup steps until a phone is connected',async({page})=>{
 await openBluetooth(page,{supported:true,active:false,phase:'off',devices:[]});
 const steps=page.getByRole('list',{name:'How to connect a phone'});await expect(steps.getByRole('listitem')).toHaveCount(5);
 await expect(steps.getByText('On your phone, open Settings → Bluetooth and choose TuneBox.')).toBeVisible();await shot(page,'bluetooth-steps');
});
test('a connected phone shows its real codec, bitrate and connection stability with an honest quality note',async({page})=>{
 await openBluetooth(page,{supported:true,active:true,phase:'active',sessionId:'00000000-0000-0000-0000-000000000000',devices:[
  {address:'AA:BB:CC:DD:EE:FF',name:'Pixel',connected:true,paired:true,link:{connectedSeconds:720,dropsLastHour:0},transport:{codec:0,configuration:[0x21,0x15,2,53],state:'active'}},
  {address:'AA:BB:CC:DD:EE:00',name:'iPhone',connected:true,paired:true,link:{connectedSeconds:300,dropsLastHour:4},transport:{codec:2,configuration:[0x80,0x01,0x8C,0x83,0xE8,0x00],state:'idle'}}]});
 const pixel=page.locator('.bluetooth-device').filter({hasText:'Pixel'}),iphone=page.locator('.bluetooth-device').filter({hasText:'iPhone'});
 await expect(pixel.getByText('SBC · up to 328 kbit/s · 44.1 kHz')).toBeVisible();await expect(pixel.getByText(/^Stable · 12 min connected · 0 drop-outs/)).toBeVisible();
 await expect(pixel.getByText(/Bluetooth always compresses audio/)).toBeVisible();
 await expect(iphone.getByText('AAC · 256 kbit/s · 44.1 kHz')).toBeVisible();await expect(iphone.getByText(/^Unstable · 5 min connected · 4 drop-outs/)).toBeVisible();
 await expect(iphone.getByText(/Move the phone closer to TuneBox/)).toBeVisible();
 await expect(page.getByRole('list',{name:'How to connect a phone'})).toHaveCount(0);await pixel.scrollIntoViewIfNeeded();await page.evaluate(()=>document.querySelector('.bluetooth-device')?.scrollIntoView({block:'start'}));await shot(page,'bluetooth-quality');
});
