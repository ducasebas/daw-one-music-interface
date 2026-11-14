import {test,expect} from '@playwright/test';
import {presets} from '../../shared/themes.js';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
const room=(id,name,extra={})=>({id,name,provider:'squeezelite',type:'player',available:true,state:id==='pi'?'playing':'idle',volume:id==='pi'?20:30,muted:false,canVolume:true,canMute:true,canPause:true,canGroup:true,canGroupWith:['pi','rivo','kitchen'],parentId:null,members:[],staticMembers:[],title:id==='pi'?'Near Light':'',artist:id==='pi'?'Ólafur Arnalds':'',isLocal:id==='pi',...extra});
test.use({viewport:{width:1280,height:800}});
async function fixture(page,{grouped=false,readOnly=false,locked=false,paused=false}={}){
 const token=(await(await page.request.get('/api/updates')).json()).controlToken;
 await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':token},data:{kind:'preferences',confirmed:true}});
 await page.request.post('/api/scenario',{data:{name:'Playback'}});
 const state={connected:true,configured:true,mode:'music-assistant',controlEnabled:!readOnly,locked,limit:40,selectedId:'pi',localId:'pi',revision:'1'.repeat(64),rooms:[room('pi','TuneBox',{state:paused?'paused':'playing',members:grouped?['rivo']:[]}),room('rivo','Rivo',{parentId:grouped?'pi':null,title:grouped?'Near Light':'',state:grouped?'playing':'idle'}),room('kitchen','Kitchen',{available:false})],sourceKey:'a'.repeat(64),canTransfer:true,queuePlayers:['pi','rivo','kitchen'],busy:false};
 const f={state,calls:[],delay:0,fail:null};let revision=2;
 await page.route('**/api/rooms',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:state});
  const body=route.request().postDataJSON();f.calls.push(body);
  if(f.delay)await new Promise(r=>setTimeout(r,f.delay));
  if(f.fail){const failure=f.fail;f.fail=null;return route.fulfill({status:409,json:{error:failure,rooms:state}});}
  if(body.revision!==state.revision)return route.fulfill({status:409,json:{error:'Rooms changed. Review the current rooms and try again.',rooms:state}});
  const p=state.rooms.find(p=>p.id===body.playerId);
  if(body.action==='group'){
   p.members=[...body.members];for(const child of state.rooms.filter(c=>c.id!==p.id)){if(body.members.includes(child.id)){child.parentId=p.id;child.title=p.title;child.state=p.state;}else if(child.parentId===p.id)child.parentId=null;}
  }else if(body.action==='leave'){state.rooms.find(c=>c.id===p.parentId).members=[];p.parentId=null;}
  else if(body.action==='select')state.selectedId=p.id;
  else if(body.action==='volume')p.volume=body.value;
  else if(body.action==='mute')p.muted=body.value;
  else if(body.action==='group-volume')for(const child of state.rooms.filter(c=>c.id===p.id||p.members.includes(c.id)))child.volume=body.value;
  else if(body.action==='group-mute')for(const child of state.rooms.filter(c=>c.id===p.id||p.members.includes(c.id)))child.muted=body.value;
  else if(body.action==='transfer'){const target=state.rooms.find(c=>c.id===body.targetId);target.state=p.state;target.title=p.title;target.artist=p.artist;p.state='idle';p.title='';state.selectedId=target.id;}
  if(['group','leave','select','transfer'].includes(body.action))state.revision=(++revision).toString(16).padStart(64,'0');
  return route.fulfill({json:{rooms:state}});
 });
 await page.goto(url);await page.getByRole('navigation',{name:'Music navigation'}).getByRole('button',{name:'Rooms',exact:true}).click();
 await expect(page.locator('.rooms-toolbar h2')).toHaveText('TuneBox');return f;
}
const card=(page,name)=>page.getByRole('article',{name,exact:true});

test('group membership previews cancel cleanly and apply once with visible waiting feedback',async({page})=>{
 const f=await fixture(page);await page.getByRole('button',{name:'Group rooms',exact:true}).click();let dialog=page.getByRole('dialog',{name:'Edit room group',exact:true});
 await dialog.getByRole('checkbox',{name:'Rivo',exact:true}).check();expect(f.calls).toHaveLength(0);await dialog.getByRole('button',{name:'Cancel',exact:true}).click();expect(f.calls).toHaveLength(0);
 await page.getByRole('button',{name:'Group rooms',exact:true}).click();dialog=page.getByRole('dialog',{name:'Edit room group',exact:true});await expect(dialog.getByRole('checkbox',{name:'Rivo',exact:true})).not.toBeChecked();
 await expect(dialog.getByRole('checkbox',{name:'Kitchen',exact:true})).toBeDisabled();await dialog.getByRole('checkbox',{name:'Rivo',exact:true}).check();f.delay=500;await dialog.getByRole('button',{name:'Save group',exact:true}).click();await expect(dialog.getByRole('button',{name:'Applying…',exact:true})).toBeDisabled();
 await expect(dialog).toHaveCount(0);expect(f.calls).toHaveLength(1);expect(f.calls[0]).toMatchObject({action:'group',playerId:'pi',members:['rivo'],confirmed:true});
 await expect(page.getByRole('region',{name:'Selected group'})).toBeVisible();await expect(card(page,'Rivo')).toContainText('Grouped with TuneBox');
 await page.screenshot({path:'test-results/multiroom-grouped.png'});
});
test('individual and group volume remain interactive while dragging and target only the chosen room/group',async({page})=>{
 const f=await fixture(page,{grouped:true});
 const own=card(page,'Rivo').getByRole('slider',{name:'Room volume',exact:true});await own.focus();await page.keyboard.press('ArrowRight');await expect.poll(()=>f.calls.length).toBe(1);expect(f.calls[0]).toMatchObject({action:'volume',playerId:'rivo',value:31});expect(f.state.rooms[0].volume).toBe(20);
 const master=page.getByRole('region',{name:'Selected group'}).getByRole('slider',{name:'Group volume',exact:true});await expect(master).toHaveAttribute('aria-disabled','false');await master.hover();const b=await master.boundingBox();

 await page.mouse.move(b.x+b.width*.2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width*.5,b.y+b.height/2);await page.waitForTimeout(120);await page.mouse.move(b.x+b.width*.8,b.y+b.height/2);await page.waitForTimeout(120);

 expect(f.calls.filter(c=>c.action==='group-volume').length).toBeGreaterThan(0);await expect(master).toHaveAttribute('aria-disabled','false');await page.mouse.up();
 await expect.poll(()=>f.calls.filter(c=>c.action==='group-volume').length).toBeGreaterThan(0);expect(f.calls.filter(c=>c.action==='group-volume').every(c=>c.playerId==='pi'&&c.value<=40)).toBe(true);
 await card(page,'Rivo').getByRole('button',{name:'Mute room',exact:true}).click();await expect(card(page,'Rivo').getByRole('button',{name:'Unmute room',exact:true})).toBeVisible();expect(f.state.rooms[0].muted).toBe(false);
});
test('moving paused music requires a destination and confirmation before changing the selected room',async({page})=>{
 const f=await fixture(page,{paused:true});await page.getByRole('button',{name:'Move music',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Move music',exact:true});
 await expect(dialog).toContainText('Paused music stays paused.');await expect(dialog.getByRole('button',{name:'Move music',exact:true})).toBeDisabled();await dialog.getByRole('button',{name:/Rivo Available destination/}).click();expect(f.calls).toHaveLength(0);
 await dialog.getByRole('button',{name:'Move music',exact:true}).click();await expect(dialog).toHaveCount(0);expect(f.calls[0]).toMatchObject({action:'transfer',playerId:'pi',targetId:'rivo',sourceKey:'a'.repeat(64),confirmed:true});
 expect(f.state.rooms.find(p=>p.id==='rivo').state).toBe('paused');await expect(page.locator('.rooms-toolbar h2')).toHaveText('Rivo');
});
test('external membership changes invalidate an open draft instead of overwriting another controller',async({page})=>{
 const f=await fixture(page);await page.getByRole('button',{name:'Group rooms',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Edit room group',exact:true});await dialog.getByRole('checkbox',{name:'Rivo',exact:true}).check();
 f.state.rooms.find(p=>p.id==='rivo').available=false;f.state.revision='b'.repeat(64);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(dialog).toContainText('Rooms or the playing track changed.');await expect(dialog.getByRole('button',{name:'Save group',exact:true})).toBeDisabled();expect(f.calls).toHaveLength(0);
 await dialog.getByRole('button',{name:'Review current rooms',exact:true}).click();await expect(dialog.getByRole('checkbox',{name:'Rivo',exact:true})).toBeDisabled();await expect(dialog.getByRole('checkbox',{name:'Rivo',exact:true})).not.toBeChecked();
});
test('read-only rooms can be selected without granting volume or group commands',async({page})=>{
 const f=await fixture(page,{readOnly:true});await expect(page.getByRole('button',{name:'Group rooms',exact:true})).toBeDisabled();await expect(card(page,'Rivo').getByRole('slider',{name:'Room volume',exact:true})).toHaveAttribute('aria-disabled','true');
 await card(page,'Rivo').getByRole('button',{name:'Control room Rivo',exact:true}).click();await expect(page.locator('.rooms-toolbar h2')).toHaveText('Rivo');expect(f.calls.map(c=>c.action)).toEqual(['select']);
});
test('settings PIN locks group changes but leaves playback volume available',async({page})=>{
 await fixture(page,{locked:true});await expect(page.getByRole('button',{name:'Group rooms',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Move music',exact:true})).toBeDisabled();await expect(card(page,'Rivo').getByRole('slider',{name:'Room volume',exact:true})).toHaveAttribute('aria-disabled','false');
});
test('command failures keep real group membership, show an owned error and never retry automatically',async({page})=>{
 const f=await fixture(page);f.fail='The room change could not be confirmed. Check the current rooms before trying again.';
 await page.getByRole('button',{name:'Group rooms',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Edit room group',exact:true});await dialog.getByRole('checkbox',{name:'Rivo',exact:true}).check();await dialog.getByRole('button',{name:'Save group',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText('could not be confirmed');expect(f.calls).toHaveLength(1);expect(f.state.rooms[0].members).toEqual([]);await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('region',{name:'Selected group'})).toHaveCount(0);
});
test('connection loss disables stale controls and focus restores fresh room status',async({page})=>{
 const f=await fixture(page);f.state.connected=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.locator('.rooms-notice')).toContainText('Music Assistant is disconnected.');await expect(card(page,'Rivo').getByRole('slider',{name:'Room volume',exact:true})).toHaveAttribute('aria-disabled','true');
 f.state.connected=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(card(page,'Rivo').getByRole('slider',{name:'Room volume',exact:true})).toHaveAttribute('aria-disabled','false');expect(f.calls).toHaveLength(0);
});
test('long room names and the room dialog fit the wall screen and the legacy display',async({page})=>{
 const f=await fixture(page,{grouped:true});f.state.rooms[1].name='Rivo · Living room beside the dining area with a very long name';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(card(page,f.state.rooms[1].name)).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBe(800);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(1280);
 await page.getByRole('button',{name:'Group rooms',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();const box=await page.getByRole('dialog').boundingBox();expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(800);await page.screenshot({path:'test-results/multiroom-group-dialog.png'});
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.setViewportSize({width:1280,height:400});expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBe(400);
});
test('Dutch rooms and a custom light theme retain readable values and a complete group dialog',async({page})=>{
 await fixture(page,{grouped:true});
 const token=(await(await page.request.get('/api/updates')).json()).controlToken,preferences=await(await page.request.get('/api/preferences')).json();
 const draft={id:'draft',name:'Light check',tokens:{...presets[0].tokens,background:'#f4efe6',surface:'#ffffff',text:'#171717',muted:'#555555',accent:'#946b28',borderColor:'#b7a688'}};
 const saved=await page.request.post('/api/preferences',{headers:{'X-TuneBox-Control':token},data:{revision:preferences.revision,patch:{language:'nl',themePreferences:{...preferences.themePreferences,mode:'manual',selected:'draft',draft}}}});expect(saved.ok()).toBe(true);
 await page.reload();await page.getByRole('navigation',{name:'Muzieknavigatie'}).getByRole('button',{name:'Ruimtes',exact:true}).click();
 await expect(page.locator('.music2')).toHaveAttribute('data-theme','draft');await expect(page.getByRole('region',{name:'Geselecteerde groep'}).getByRole('slider',{name:'Groepsvolume',exact:true})).toBeVisible();
 await expect(card(page,'Rivo').getByRole('button',{name:'Kamervolume lager',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(1280);
 await page.getByRole('button',{name:'Ruimtes groeperen',exact:true}).hover();await page.screenshot({path:'test-results/multiroom-dutch-light.png',animations:'disabled'});
 await page.getByRole('button',{name:'Ruimtes groeperen',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Ruimtegroep bewerken'});await expect(dialog).toBeVisible();const b=await dialog.boundingBox();expect(b.y).toBeGreaterThanOrEqual(0);expect(b.y+b.height).toBeLessThanOrEqual(800);await expect(dialog.getByRole('button',{name:'Annuleren',exact:true})).toBeVisible();
});
