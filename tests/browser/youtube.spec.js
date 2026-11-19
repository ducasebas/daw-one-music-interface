import {test, expect} from '@playwright/test';
import {chooseSettingsSection} from './settings-helpers.js';
const url='/?gui=2&screen=1&display=dsi-production&panel=wall-16-10';
const videoId='dQw4w9WgXcQ';
test.use({viewport:{width:1280,height:800},reducedMotion:'reduce'});
async function nonce(page){return (await(await page.request.get('/api/updates')).json()).controlToken;}
async function options(page, patch){const settings=await(await page.request.get('/api/youtube/settings')).json();const r=await page.request.post('/api/youtube/settings',{headers:{'X-TuneBox-Control':await nonce(page)},data:{...settings,...patch}});expect(r.ok(),await r.text()).toBe(true);}
async function link(page){const current=await(await page.request.get('/api/video')).json();const r=await page.request.post('/api/video/youtube',{headers:{'X-TuneBox-Control':await nonce(page)},data:{trackKey:current.trackKey,video:videoId}});expect(r.ok()).toBe(true);}
async function setup(page){await chooseSettingsSection(page,'Connections',{open:true});await page.getByRole('button',{name:'YouTube Music',exact:true}).click();await page.getByRole('button',{name:'Set up YouTube Music',exact:true}).click();return page.getByRole('dialog',{name:'YouTube Music setup',exact:true});}
async function accountFixture(page,{available=true,issue=null}={}){
 await page.route('**/api/youtube/status',async route=>{
  const settings=await(await page.request.get('/api/youtube/settings')).json();
  return route.fulfill({json:{settings,connected:true,serverVersion:'fixture',webUrl:'http://music.test:8095/',sources:[{id:'ytmusic--fixture',name:'My YouTube Music',available,enabled:true,issue}],selectedId:'ytmusic--fixture',sourceState:available?'connected':'needs-attention',subscription:available?'accepted-by-music-assistant':'not-verified'}});
 });
}
async function playerFixture(page,{readyDelay=0,durationAfterPlay=false}={}){
 await page.route('https://www.youtube-nocookie.com/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>YouTube fixture</title>'}));
 await page.addInitScript(({readyDelay,durationAfterPlay})=>{
  window.youtubeFixture={players:[],commands:[]};
  window.YT={Player:class{
   constructor(iframe,{events}){this.iframe=iframe;this.events=events;this.state=2;this.position=0;this.stamp=performance.now();this.volume=100;this.muted=false;this.destroyed=false;this.ready=false;this.hasPlayed=false;window.youtubeFixture.players.push(this);setTimeout(()=>{this.ready=true;events.onReady({target:this});},readyDelay);}
   getDuration(){return durationAfterPlay&&!this.hasPlayed?0:360;}
   getCurrentTime(){return this.position+(this.state===1?(performance.now()-this.stamp)/1000:0);}
   getPlayerState(){return this.state;}
   mute(){if(!this.ready)throw Error('YouTube API not ready');this.muted=true;}
   getVolume(){return this.volume;}
   setVolume(value){this.volume=value;}
   seekTo(value){this.position=value;this.stamp=performance.now();window.youtubeFixture.commands.push({type:'seek',value});}
   playVideo(){this.hasPlayed=true;if(this.state===1)return;this.stamp=performance.now();this.state=1;window.youtubeFixture.commands.push({type:'play'});queueMicrotask(()=>this.events.onStateChange({data:1}));}
   pauseVideo(){if(this.state===2)return;this.position=this.getCurrentTime();this.state=2;window.youtubeFixture.commands.push({type:'pause'});queueMicrotask(()=>this.events.onStateChange({data:2}));}
   stopVideo(){this.state=0;}
   destroy(){this.destroyed=true;this.iframe.remove();}
  }};
 },{readyDelay,durationAfterPlay});
}
test.beforeEach(async({page})=>{
 const token=await nonce(page);
 await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':token},data:{kind:'preferences',confirmed:true}});
 await options(page,{providerId:null,consent:false,followCurrent:false});
 await page.request.post('/api/scenario',{data:{name:'Playback'}});
 await page.request.delete('/api/video',{headers:{'X-TuneBox-Control':token}});
 const p=await(await page.request.get('/api/preferences')).json();
 await page.request.post('/api/preferences',{headers:{'X-TuneBox-Control':token},data:{revision:p.revision,patch:{prefs:{...p.prefs,startupAnimation:'off',artwork:'cover'}}}});
});
test.afterEach(async({page})=>{await options(page,{providerId:null,consent:false,followCurrent:false});});

test('account wizard hands login to Music Assistant, shows source checks and keeps all steps touch-sized',async({page})=>{
 await accountFixture(page);await playerFixture(page);await page.goto(url);
 const wizard=await setup(page);await expect(wizard.getByText('Account accepted by Music Assistant',{exact:true})).toBeVisible();
 await wizard.getByRole('button',{name:'Connect or repair account',exact:true}).click();await expect(wizard.getByRole('img',{name:'Open Music Assistant',exact:true})).toBeVisible();
 await expect(wizard.getByText('Your account details stay in Music Assistant. Follow its instructions on your computer; do not enter your Google password on TuneBox.',{exact:true})).toBeVisible();
 await expect(wizard.locator('input[type=password]')).toHaveCount(0);
 for(const button of await wizard.locator(':scope > nav button').all()){await expect(button).toBeInViewport();expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(56);}
 const tabs=await wizard.locator(':scope > nav button').evaluateAll(nodes=>nodes.map(n=>({x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y,width:n.getBoundingClientRect().width})));
 expect(tabs).toHaveLength(5);expect(Math.abs(tabs[0].y-tabs[4].y)).toBeLessThan(2);expect(tabs[0].width).toBeGreaterThan(150);expect(tabs[4].x).toBeGreaterThan(tabs[0].x);
 expect(await wizard.locator(':scope > footer').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(18);
 await wizard.getByRole('button',{name:'Next',exact:true}).click();await wizard.getByRole('button',{name:'Skip this step',exact:true}).click();
 const allow=wizard.getByLabel('Allow YouTube video',{exact:true});await allow.check();await wizard.getByLabel('Follow YouTube Music tracks automatically',{exact:true}).check();
 await expect(wizard.getByRole('button',{name:'Save and continue',exact:true})).toBeEnabled();
 await wizard.getByRole('button',{name:'Save and continue',exact:true}).click();
 const saved=await(await page.request.get('/api/youtube/settings')).json();expect(saved.consent).toBe(true);expect(saved.followCurrent).toBe(true);
 await expect(wizard.getByRole('heading',{name:'Match video timing',exact:true})).toBeVisible();
 await page.screenshot({path:'test-results/youtube-wizard-1280x800.png'});
});
test('failed Premium or expired source does not enable the connected-account step and can be skipped',async({page})=>{
 await accountFixture(page,{available:false,issue:'premium-required'});await page.goto(url);
 const wizard=await setup(page);await expect(wizard.getByText('Music Assistant reports that this account needs YouTube Music Premium.',{exact:true})).toBeVisible();
 await expect(wizard.getByRole('button',{name:'Next',exact:true})).toBeDisabled();
 await wizard.getByRole('button',{name:'Skip this step',exact:true}).click();await expect(wizard.getByRole('heading',{name:'Choose the player to follow',exact:true})).toBeVisible();
});
test('no YouTube request or frame is made before video consent',async({page})=>{
 const requests=[];page.on('request',r=>{if(/youtube|googlevideo|ytimg/.test(new URL(r.url()).hostname))requests.push(r.url());});
 await link(page);await page.goto(url);await page.getByRole('button',{name:'Video Artwork',exact:true}).click();
 await expect(page.getByText('YouTube video is disabled',{exact:true}).first()).toBeVisible();await expect(page.locator('.youtube-frame iframe')).toHaveCount(0);expect(requests).toEqual([]);
});
test('silent video follows pause and seeking, retains one iframe in full screen and never sends audio commands',async({page})=>{
 await playerFixture(page);await options(page,{consent:true});await link(page);
 const audio=[];page.on('request',r=>{if(new URL(r.url()).pathname==='/api/event'){try{const e=r.postDataJSON();if(['play','pause','next','previous','seek','volume','mute'].includes(e?.type))audio.push(e);}catch{}}});
 await page.goto(url);await page.getByRole('button',{name:'Video Artwork',exact:true}).click();
 await expect(page.locator('.youtube-player')).toHaveAttribute('data-player-state','playing');
 await expect.poll(()=>page.evaluate(()=>window.youtubeFixture.players[0].muted&&window.youtubeFixture.players[0].volume===0)).toBe(true);
 const frame=page.locator('.youtube-frame iframe');await expect(frame).toHaveAttribute('referrerpolicy','strict-origin-when-cross-origin');
 await expect(frame).toHaveAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');
 await frame.evaluate(node=>node.dataset.sameFrame='yes');
 await page.getByRole('button',{name:'Full screen video',exact:true}).click();
 const full=page.getByRole('dialog',{name:'Full screen video',exact:true});await expect(full).toBeVisible();await expect(full.locator('iframe')).toHaveAttribute('data-same-frame','yes');
 await page.request.post('/api/event',{data:{type:'pause'}});await expect(page.locator('.youtube-player')).toHaveAttribute('data-player-state','paused');
 await page.request.post('/api/event',{data:{type:'seek',position:90}});await expect.poll(()=>page.evaluate(()=>window.youtubeFixture.commands.filter(v=>v.type==='seek').at(-1)?.value)).toBeGreaterThan(89);
 await page.request.post('/api/event',{data:{type:'play'}});await expect(page.locator('.youtube-player')).toHaveAttribute('data-player-state','playing');
 await full.getByRole('button',{name:'Back to music',exact:true}).click();await expect(frame).toHaveAttribute('data-same-frame','yes');
 expect(await page.evaluate(()=>window.youtubeFixture.players.length)).toBe(1);expect(audio).toEqual([]);
});
test('consent withdrawal and track changes remove the old video immediately, without pausing music',async({page})=>{
 await playerFixture(page);await options(page,{consent:true});await link(page);await page.goto(url);await page.getByRole('button',{name:'Video Artwork',exact:true}).click();await expect(page.locator('.youtube-player')).toHaveAttribute('data-player-state','playing');
 await page.request.post('/api/event',{data:{type:'next'}});await expect(page.locator('.youtube-frame iframe')).toHaveCount(0);await expect(page.getByText('No video linked to this track',{exact:true})).toBeVisible();
 await page.request.post('/api/event',{data:{type:'previous'}});await expect(page.locator('.youtube-player')).toHaveAttribute('data-player-state','playing');
 await options(page,{consent:false});await expect(page.locator('.youtube-frame iframe')).toHaveCount(0);await expect(page.getByText('YouTube video is disabled',{exact:true}).first()).toBeVisible();
 expect((await(await page.request.get('/api/state')).json()).playback.playing).toBe(true);
});
test('a blocked embed and autoplay restriction show owned feedback while music keeps playing',async({page})=>{
 await playerFixture(page);await options(page,{consent:true});await link(page);await page.goto(url);await page.getByRole('button',{name:'Video Artwork',exact:true}).click();await expect(page.locator('.youtube-player')).toHaveAttribute('data-player-state','playing');
 await page.evaluate(()=>window.youtubeFixture.players[0].events.onAutoplayBlocked());await expect(page.getByRole('button',{name:'Start silent video',exact:true})).toBeVisible();await page.getByRole('button',{name:'Start silent video',exact:true}).click();
 await page.evaluate(()=>window.youtubeFixture.players[0].events.onError({data:150}));await expect(page.getByText('The video owner does not allow embedded playback.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Retry video',exact:true})).toBeVisible();
 expect((await(await page.request.get('/api/state')).json()).playback.playing).toBe(true);
});
test('video setup links through the owned keyboard and rejects timing saved for a different track',async({page})=>{
 await playerFixture(page);await accountFixture(page);await page.goto(url);const wizard=await setup(page);
 await wizard.getByRole('button',{name:'Next',exact:true}).click();await wizard.getByRole('button',{name:'Skip this step',exact:true}).click();await wizard.getByLabel('Allow YouTube video',{exact:true}).check();
 await wizard.getByLabel('YouTube video link',{exact:true}).click();const keyboard=page.getByRole('dialog',{name:'Touch keyboard',exact:true});await expect(keyboard).toBeVisible();await keyboard.getByLabel('Keyboard entry',{exact:true}).fill('https://youtu.be/'+videoId);await keyboard.getByRole('button',{name:'Done typing',exact:true}).click();
 await wizard.getByRole('button',{name:'Save and continue',exact:true}).click();await expect(wizard.getByRole('heading',{name:'Match video timing',exact:true})).toBeVisible();await expect(wizard.locator('.youtube-player')).toHaveAttribute('data-player-state','playing');
 const correction=wizard.getByLabel('YouTube video correction',{exact:true});await correction.fill('1.2');await wizard.getByRole('button',{name:'Save and continue',exact:true}).click();await expect(wizard.getByRole('heading',{name:'Ready to watch',exact:true})).toBeVisible();
 const saved=await(await page.request.get('/api/video')).json();expect(saved.sync.offsetSeconds).toBe(1.2);expect(saved.source).toBe('youtube');
 await wizard.getByRole('button',{name:'Back',exact:true}).click();await page.request.post('/api/event',{data:{type:'next'}});await expect(wizard.locator('.youtube-frame iframe')).toHaveCount(0);
 await expect(wizard.getByText('Play a YouTube Music track or link a video first. You can finish setup and adjust timing later.',{exact:true})).toBeVisible();
});
test('a video preview that is scrolled out of view pauses decoding and resumes at the music position',async({page})=>{
 await playerFixture(page);await accountFixture(page);await options(page,{consent:true});await link(page);await page.goto(url);const wizard=await setup(page);
 await wizard.getByRole('button',{name:'Next',exact:true}).click();await wizard.getByRole('button',{name:'Skip this step',exact:true}).click();await wizard.getByRole('button',{name:'Save and continue',exact:true}).click();await expect(wizard.locator('.youtube-player')).toHaveAttribute('data-player-state','playing');
 await wizard.locator('.youtube-wizard-body').evaluate(node=>{const spacer=document.createElement('div');spacer.style.height='1000px';node.append(spacer);node.scrollTo(0,node.scrollHeight);});await expect(wizard.locator('.youtube-player')).toHaveAttribute('data-player-state','paused');
 await wizard.locator('.youtube-wizard-body').evaluate(node=>node.scrollTo(0,0));await expect(wizard.locator('.youtube-player')).toHaveAttribute('data-player-state','playing');expect((await(await page.request.get('/api/state')).json()).playback.playing).toBe(true);
});
test('a slow IFrame API and metadata available only after play cannot deadlock the silent player',async({page})=>{
 await playerFixture(page,{readyDelay:1200,durationAfterPlay:true});await options(page,{consent:true});await link(page);await page.goto(url);await page.getByRole('button',{name:'Video Artwork',exact:true}).click();
 await expect(page.locator('.youtube-frame iframe')).toHaveCSS('opacity','0');await expect(page.locator('.youtube-player')).toHaveAttribute('data-player-state','playing');await expect(page.locator('.youtube-frame iframe')).toHaveCSS('opacity','1');await expect(page.getByRole('button',{name:'Retry video',exact:true})).toHaveCount(0);expect(await page.evaluate(()=>window.youtubeFixture.players.at(-1).muted&&window.youtubeFixture.players.at(-1).hasPlayed)).toBe(true);
});
test('enabling Video Artwork in the wizard survives Save and immediately opens the player on Now Playing',async({page})=>{
 await playerFixture(page);await accountFixture(page);await options(page,{consent:true});await link(page);await page.goto(url);
 const wizard=await setup(page);await wizard.getByRole('button',{name:'Next',exact:true}).click();await wizard.getByRole('button',{name:'Skip this step',exact:true}).click();await wizard.getByRole('button',{name:'Save and continue',exact:true}).click();await expect(wizard.locator('.youtube-player')).toHaveAttribute('data-player-state','playing');
 await wizard.getByRole('button',{name:'Next',exact:true}).click();await wizard.getByRole('button',{name:'Enable Video Artwork',exact:true}).click();await expect(wizard).toHaveCount(0);
 const save=page.getByRole('button',{name:'Save',exact:true});await expect(save).toBeEnabled();await save.click();await expect(page.locator('[data-saved=true]')).toBeVisible();
 await page.getByRole('button',{name:'Open Now Playing',exact:true}).click();await expect(page.locator('.youtube-player')).toHaveAttribute('data-player-state','playing');await expect(page.getByRole('button',{name:'Video Artwork',exact:true})).toHaveAttribute('aria-pressed','true');
});
test('screen rest and visibility loss pause YouTube while the Music Assistant clock continues',async({page})=>{
 await playerFixture(page);await options(page,{consent:true});await link(page);await page.goto(url);await page.getByRole('button',{name:'Video Artwork',exact:true}).click();await expect(page.locator('.youtube-player')).toHaveAttribute('data-player-state','playing');
 await page.evaluate(()=>{window.youtubeHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.youtubeHidden});document.dispatchEvent(new Event('visibilitychange'));});
 await expect.poll(()=>page.evaluate(()=>window.youtubeFixture.players.filter(p=>!p.destroyed).every(p=>p.state!==1))).toBe(true);
 await page.evaluate(()=>{window.youtubeHidden=false;document.dispatchEvent(new Event('visibilitychange'));});await expect(page.locator('.youtube-player')).toHaveAttribute('data-player-state','playing');
 await page.request.post('/api/event',{data:{type:'display-timeout'}});await expect.poll(()=>page.evaluate(()=>window.youtubeFixture.players.filter(p=>!p.destroyed).every(p=>p.state!==1))).toBe(true);
 expect((await(await page.request.get('/api/state')).json()).playback.playing).toBe(true);
 await page.request.post('/api/activity');await expect(page.locator('.youtube-player')).toHaveAttribute('data-player-state','playing');
});
test('an unavailable YouTube script fails inside the owned player and leaves music untouched',async({page})=>{
 await page.route('https://www.youtube.com/iframe_api',r=>r.abort());await options(page,{consent:true});await link(page);await page.goto(url);await page.getByRole('button',{name:'Video Artwork',exact:true}).click();
 await expect(page.getByText('YouTube could not load. Check the internet connection and retry.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Retry video',exact:true})).toBeVisible();expect((await(await page.request.get('/api/state')).json()).playback.playing).toBe(true);
});
