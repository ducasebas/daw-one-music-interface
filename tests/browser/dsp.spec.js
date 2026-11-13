import {test,expect} from '@playwright/test';
import {chooseSettingsSection} from './settings-helpers.js';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
test.use({viewport:{width:1280,height:800}});
async function fixture(page,on=0,labels=true){
 const token=(await(await page.request.get('/api/updates')).json()).controlToken;
 await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':token},data:{kind:'preferences',confirmed:true}});
 await page.request.post('/api/scenario',{data:{name:'Playback'}});
 const off=1-on,calls=[];
 let controls=[{id:22,name:'Equalizer',min:0,max:1,value:off,type:'ENUMERATED',...(labels?{options:[{value:on,label:'On'},{value:off,label:'Off'}]}:{})},{id:5,name:'00020 Hz',min:-15,max:15,value:-2,type:'INTEGER'},{id:6,name:'Channel Left Gain',min:-110,max:0,value:-3,type:'INTEGER'},{id:7,name:'Channel Right Gain',min:-110,max:0,value:-3,type:'INTEGER'}];
 const status=()=>({supported:true,card:'LouderRaspberry',controls,faults:[]});
 await page.route('**/api/device',async route=>{const body=route.request().postDataJSON();if(body.command==='dsp')return route.fulfill({json:status()});if(body.command==='dsp-set'){calls.push(body.args.controls);controls=controls.map(c=>({...c,value:body.args.controls.find(x=>x.id===c.id)?.value??c.value}));return route.fulfill({json:{saved:true,...status()}});}return route.continue();});
 await page.goto(url);await chooseSettingsSection(page,'Audio',{open:true});
 return {calls,off,on,controls:()=>controls};
}
for(const on of [0,1])test(`equalizer follows ALSA labels with On=${on}; presets preview, cancel and save correctly`,async({page})=>{
 const f=await fixture(page,on);const surface=page.getByRole('region',{name:'Louder HAT DSP controls'}),eq=page.getByRole('checkbox',{name:'Equalizer',exact:true});
 await expect(eq).not.toBeChecked();await expect(page.getByLabel('Equalizer state',{exact:true})).toHaveText('Off');
 await page.getByRole('button',{name:'Flat',exact:true}).click();await expect(eq).toBeChecked();await expect(page.getByRole('slider',{name:'EQ 20 Hz',exact:true})).toHaveValue('0');expect(f.calls).toHaveLength(0);
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(eq).not.toBeChecked();await expect(page.getByRole('slider',{name:'EQ 20 Hz',exact:true})).toHaveValue('-2');
 await page.getByRole('button',{name:'Soft',exact:true}).click();await expect(eq).toBeChecked();await expect(page.getByRole('slider',{name:'EQ 20 Hz',exact:true})).toHaveValue('-3');await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.locator('[data-saved=true]')).toBeVisible();expect(f.calls.at(-1)).toEqual(expect.arrayContaining([{id:22,value:on},{id:5,value:-3}]));
 await eq.uncheck();await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('[data-saved=true]')).toBeVisible();expect(f.calls.at(-1)).toContainEqual({id:22,value:f.off});
 await page.getByRole('button',{name:'Restore defaults',exact:true}).click();await expect(eq).toBeChecked();await expect(page.getByRole('slider',{name:'EQ 20 Hz',exact:true})).toHaveValue('0');
 expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBe(800);await eq.scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/dsp-labels-on-${on}.png`});
});
test('missing driver enum labels disable switching and presets instead of guessing',async({page})=>{
 const f=await fixture(page,0,false);await expect(page.getByRole('checkbox',{name:'Equalizer',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Flat',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Soft',exact:true})).toBeDisabled();await expect(page.getByText('Equalizer labels are unavailable. Complete the device update to use DSP presets.',{exact:true})).toBeVisible();expect(f.calls).toHaveLength(0);
});
