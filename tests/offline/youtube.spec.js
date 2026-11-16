import {test,expect} from '@playwright/test';
test.use({viewport:{width:1280,height:800}});
test('the never-visited YouTube wizard opens from the offline shell without claiming a linked account',async({page,context})=>{
 const token=(await(await page.request.get('/api/updates')).json()).controlToken;
 await page.request.post('/api/reset',{headers:{'X-TuneBox-Control':token},data:{kind:'preferences',confirmed:true}});
 const settings=await(await page.request.get('/api/youtube/settings')).json();await page.request.post('/api/youtube/settings',{headers:{'X-TuneBox-Control':token},data:{...settings,providerId:null,consent:false,followCurrent:false}});
 await page.request.post('/api/scenario',{data:{name:'Playback'}});await page.goto('/?gui=2&screen=1&display=dsi-production&panel=wall-16-10');
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(v=>v.name));expect(resources.some(v=>/\/assets\/YoutubeWizard-/.test(v))).toBe(false);
 await context.setOffline(true);await page.reload();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('navigation',{name:'Settings categories'}).getByRole('button',{name:'Connections',exact:true}).click();
 await page.getByRole('button',{name:'YouTube Music',exact:true}).click();await page.getByRole('button',{name:'Set up YouTube Music',exact:true}).click();
 const wizard=page.getByRole('dialog',{name:'YouTube Music setup',exact:true});await expect(wizard).toBeVisible();await expect(wizard.getByRole('button',{name:'Next',exact:true})).toBeDisabled();await wizard.getByRole('button',{name:'Skip this step',exact:true}).click();await expect(wizard.getByRole('heading',{name:'Choose the player to follow',exact:true})).toBeVisible();await expect(page.locator('.youtube-frame iframe')).toHaveCount(0);
});
test('the production player sends its origin referrer despite the document same-origin policy',async({page})=>{
 const token=(await(await page.request.get('/api/updates')).json()).controlToken,auth={'X-TuneBox-Control':token};
 await page.request.post('/api/reset',{headers:auth,data:{kind:'preferences',confirmed:true}});await page.request.post('/api/scenario',{data:{name:'Playback'}});
 const settings=await(await page.request.get('/api/youtube/settings')).json();await page.request.post('/api/youtube/settings',{headers:auth,data:{...settings,consent:true,followCurrent:false}});
 const track=await(await page.request.get('/api/video')).json();await page.request.post('/api/video/youtube',{headers:auth,data:{trackKey:track.trackKey,video:'dQw4w9WgXcQ'}});
 const preferences=await(await page.request.get('/api/preferences')).json();await page.request.post('/api/preferences',{headers:auth,data:{revision:preferences.revision,patch:{prefs:{...preferences.prefs,startupAnimation:'off',artwork:'video'}}}});
 let referer;
 await page.route('https://www.youtube.com/iframe_api',route=>route.fulfill({contentType:'application/javascript',body:`window.YT={Player:class{constructor(frame,options){this.frame=frame;this.state=2;queueMicrotask(()=>options.events.onReady());}mute(){}getVolume(){return 0;}setVolume(){}getDuration(){return 360;}getCurrentTime(){return 0;}getPlayerState(){return this.state;}seekTo(){}playVideo(){this.state=1;}pauseVideo(){this.state=2;}stopVideo(){}destroy(){this.frame.remove();}}};window.onYouTubeIframeAPIReady();`}));
 await page.route('https://www.youtube-nocookie.com/**',async route=>{referer=(await route.request().allHeaders()).referer;await route.fulfill({contentType:'text/html',body:'<!doctype html><title>YouTube fixture</title>'});});
 await page.goto('/?gui=2&screen=1&display=dsi-production&panel=wall-16-10');await expect(page.locator('.youtube-player')).toHaveAttribute('data-player-state','playing');expect(referer).toBe('http://127.0.0.1:3001/');
 const saved=await(await page.request.get('/api/youtube/settings')).json();await page.request.post('/api/youtube/settings',{headers:auth,data:{...saved,consent:false,followCurrent:false}});await expect(page.locator('.youtube-frame iframe')).toHaveCount(0);
});
