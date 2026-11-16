import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, statSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {youtubeVideoId, youtubeTrackVideoId, youtubeSettings, youtubeDefaults, youtubeAdjustment} from '../shared/youtube.js';
import {YoutubeService} from '../server/youtube-service.js';
import {VideoLibrary} from '../server/video-library.js';
import {normalizeMusic} from '../server/ma-service.js';

const id = 'dQw4w9WgXcQ';
test('YouTube links accept exact videos and reject foreign hosts, credentials and active content', () => {
  for (const url of [id, `https://youtube.com/watch?v=${id}&list=abc`, `https://youtu.be/${id}?t=20`, `https://music.youtube.com/watch?v=${id}`, `https://www.youtube-nocookie.com/embed/${id}`, `https://www.youtube.com/shorts/${id}`]) assert.equal(youtubeVideoId(url), id);
  for (const url of ['javascript:alert(1)', `https://youtube.com.evil.test/watch?v=${id}`, `https://youtube.com@evil.test/watch?v=${id}`, `https://user@youtube.com/watch?v=${id}`, `http://youtube.com/watch?v=${id}`, 'https://youtube.com/playlist?list=abc', id + '/x', 'https://youtu.be/' + id + '/extra', null]) assert.equal(youtubeVideoId(url), null);
});
test('automatic video follows only a real YouTube Music provider mapping, never a title match', () => {
  assert.equal(youtubeTrackVideoId({provider: 'ytmusic', item_id: id}), id);
  assert.equal(youtubeTrackVideoId({provider: 'library', item_id: '1', provider_mappings: [{provider_domain: 'ytmusic', item_id: id, available: true}]}), id);
  assert.equal(youtubeTrackVideoId({provider: 'spotify', item_id: id}), null);
  assert.equal(youtubeTrackVideoId({provider_mappings: [{provider_domain: 'ytmusic', item_id: id, available: false}]}), null);
  assert.equal(youtubeTrackVideoId({name: id}), null);
  assert.equal(youtubeTrackVideoId({streamdetails:{provider:'ytmusic--one',item_id:'aqz-KE-bpKQ'},media_item:{provider_mappings:[{provider_domain:'ytmusic',item_id:id}]}}),'aqz-KE-bpKQ');
  const playback = normalizeMusic({player: {player_id: 'local', available: true, current_media: {media_item: {uri: 'ytmusic://track/' + id, name: 'Song', provider_mappings: [{provider_domain: 'ytmusic', item_id: id}]}, duration: 200}}});
  assert.equal(playback.queue[0].youtubeVideoId, id);
});
test('YouTube consent and bounded drift corrections are explicit', () => {
  assert.throws(() => youtubeSettings({...youtubeDefaults, cookie: 'secret'}));
  assert.throws(() => youtubeSettings({...youtubeDefaults, followCurrent: true}));
  assert.throws(() => youtubeSettings({...youtubeDefaults, providerId: '../other'}));
  assert.equal(youtubeSettings({...youtubeDefaults, consent: true, followCurrent: true}).consent, true);
  assert.equal(youtubeAdjustment({target: 10.5, current: 10, now: 5000}), false);
  assert.equal(youtubeAdjustment({target: 15, current: 10, now: 5000}), true);
  assert.equal(youtubeAdjustment({target: 15, current: 10, now: 5000, lastSeek: 4500}), false);
  assert.equal(youtubeAdjustment({target: 15, current: 10, now: 5000, lastSeek: 4500, force: true}), true);
});
test('source checks deduplicate, retain missing-account errors and never return provider secrets', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tunebox-youtube-'));
  let now = 0, available = true, last_error = '', calls = [];
  const music = {status: 'connected', config: {url: 'ws://music.local:8095/ws'}, transport: {info: {server_version: '2.10.9'}, async command(command, args) {
    calls.push({command, args}); await new Promise(r => setImmediate(r));
    return command === 'providers' ? available ? [{domain: 'ytmusic', instance_id: 'ytmusic--one', name: 'YT', available: true, cookie: 'do-not-return'}] : [] : [{domain: 'ytmusic', instance_id: 'ytmusic--one', enabled: true, last_error, values: {cookie: 'do-not-return', token: 'private'}}];
  }}};
  try {
    const service = new YoutubeService(music, directory, {now: () => now});
    const results = await Promise.all([service.status(), service.status()]);
    assert.equal(calls.length, 2); assert.equal(results[0].sourceState, 'connected');
    assert.equal(results[0].subscription, 'accepted-by-music-assistant'); assert.equal(results[0].webUrl, 'http://music.local:8095/');
    assert.doesNotMatch(JSON.stringify(results), /do-not-return|private|cookie|values/);
    await service.status(); assert.equal(calls.length, 2);
    available = false; last_error = 'User does not have YouTube Music Premium'; now = 4000;
    const failed = await service.status(); assert.equal(failed.sourceState, 'needs-attention'); assert.equal(failed.sources[0].issue, 'premium-required'); assert.equal(failed.subscription, 'not-verified');
    last_error = 'PO Token server URL is not reachable'; now = 8000;
    assert.equal((await service.status()).sources[0].issue, 'token-server-unavailable');
    last_error = '401 unauthorized cookie private-do-not-echo'; now = 12000;
    const expired = await service.status(); assert.equal(expired.sources[0].issue, 'account-expired'); assert.doesNotMatch(JSON.stringify(expired), /private-do-not-echo/);
    const saved = service.save({...youtubeDefaults, consent: true, followCurrent: true, providerId: 'ytmusic--one'});
    assert.equal(saved.revision, 1); assert.equal(statSync(join(directory, 'youtube.json')).mode & 0o777, 0o600);
    assert.deepEqual(new YoutubeService(music, directory).get(), saved); assert.doesNotMatch(readFileSync(join(directory, 'youtube.json'), 'utf8'), /cookie|token/);
    assert.throws(() => service.save({...youtubeDefaults, consent: true}));
    service.reset(); assert.deepEqual(service.get(), youtubeDefaults);
    assert.ok(calls.every(c => ['providers', 'config/providers'].includes(c.command)), 'no playback, grouping or account mutation');
  } finally {rmSync(directory, {recursive: true, force: true});}
});
test('unknown source permissions and an offline server never appear connected', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tunebox-youtube-'));
  try {
    const music = {status: 'disconnected', config: {url: 'https://user:secret@ma.test/'}};
    const service = new YoutubeService(music, directory);
    assert.equal((await service.status()).connected, false); assert.equal((await service.status()).webUrl, null);
    music.status = 'connected'; music.transport = {async command(command) {if (command === 'providers') return []; throw Error('private token in upstream message');}};
    assert.equal((await service.status()).sourceState, 'unknown');
    const denied = new YoutubeService({...music, transport: {async command() {throw Error('secret');}}}, directory);
    await assert.rejects(() => denied.status(), /could not read/);
  } finally {rmSync(directory, {recursive: true, force: true});}
});
test('YouTube links and timing are pinned to a track; file-serving remains local-only', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tunebox-youtube-video-'));
  const a = {id: 'a', title: 'One', artist: 'Artist', duration: 200}, b = {...a, id: 'b', title: 'Two'};
  try {
    const library = new VideoLibrary(directory), key = library.get(a).trackKey;
    assert.throws(() => library.linkYoutube(a, {trackKey: key, video: 'https://evil.test/' + id}));
    assert.throws(() => library.linkYoutube(b, {trackKey: key, video: id}));
    const linked = library.linkYoutube(a, {trackKey: key, video: 'https://youtu.be/' + id});
    assert.equal(linked.source, 'youtube'); assert.equal(linked.available, true); assert.equal(linked.videoId, id); assert.equal(linked.url, null); assert.equal(library.path(id), null);
    assert.equal(library.get(b).available, false);
    const timing = {trackKey: key, id, revision: linked.revision, sync: {mode: 'starts', offsetSeconds: 1.2}};
    assert.throws(() => library.timing(b, timing)); assert.equal(library.timing(a, timing).sync.offsetSeconds, 1.2);
    assert.throws(() => library.timing(a, timing));
    library.remove(a, {disableAutomatic: true}); assert.equal(library.get(a).disabled, true); assert.equal(library.get(a).available, false);
  } finally {rmSync(directory, {recursive: true, force: true});}
});
test('automatic video requires consent and exact metadata, and stale automatic timing cannot overwrite a saved link',()=>{
 const directory=mkdtempSync(join(tmpdir(),'tunebox-youtube-auto-'));
 try{
  const service=new YoutubeService(null,directory),library=new VideoLibrary(directory),track={id:'a',title:'Song',duration:200,youtubeVideoId:id};
  assert.equal(service.videoLink(track,library.get(track)).available,false);
  service.save({...service.get(),consent:true,followCurrent:true});
  const automatic=service.videoLink(track,library.get(track));assert.equal(automatic.automatic,true);assert.equal(automatic.videoId,id);
  assert.equal(service.videoLink({...track,youtubeVideoId:null},library.get(track)).available,false);
  assert.equal(service.videoLink({...track,duration:null},library.get(track)).available,false);
  const saved=library.linkYoutube(track,{trackKey:automatic.trackKey,video:id,sync:{mode:'starts',offsetSeconds:1.2}});
  assert.notEqual(saved.revision,automatic.revision);
  assert.throws(()=>library.timing(track,{trackKey:automatic.trackKey,id,revision:automatic.revision,sync:{mode:'starts',offsetSeconds:5}}));
  assert.equal(service.videoLink(track,library.get(track)).sync.offsetSeconds,1.2);
  library.remove(track,{disableAutomatic:true});assert.equal(service.videoLink(track,library.get(track)).available,false);
  service.save({...service.get(),consent:false,followCurrent:false});assert.equal(service.videoLink(track,{...saved}).consent,false);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
