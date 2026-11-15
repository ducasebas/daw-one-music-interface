import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('YouTube endpoints enforce nonce, origin, PIN, consent and stale-track guards without sending music commands', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tunebox-youtube-http-'));
  const listener = createServer(); await new Promise(r => listener.listen(0, '127.0.0.1', r)); const port = listener.address().port; await new Promise(r => listener.close(r));
  const child = spawn(process.execPath, ['server/index.js'], {env: {...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), DAW_STATE_DIR: directory, DAW_PLAYBACK_MODE: 'simulation'}, stdio: 'ignore'});
  const base = 'http://127.0.0.1:' + port;
  const get = async path => (await fetch(base + path)).json();
  const post = (path, data, headers = {}) => fetch(base + path, {method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(data)});
  try {
    let ready = false; for (let i = 0; i < 80; i++) {try {if ((await fetch(base + '/api/health')).ok) {ready = true; break;}} catch {} await new Promise(r => setTimeout(r, 50));} assert.ok(ready);
    const token = (await get('/api/updates')).controlToken, auth = {'X-TuneBox-Control': token};
    await post('/api/scenario', {name: 'Playback'}); const before = await get('/api/state'), track = await get('/api/video');
    const status = await get('/api/youtube/status'); assert.equal(status.connected, false); assert.equal(status.subscription, 'not-verified');
    const options = await get('/api/youtube/settings');
    assert.equal((await post('/api/youtube/settings', {...options, consent: true})).status, 403);
    assert.equal((await post('/api/youtube/settings', {...options, consent: true}, {...auth, Origin: 'https://foreign.test'})).status, 403);
    assert.equal((await post('/api/youtube/settings', {...options, followCurrent: true}, auth)).status, 409);
    assert.equal((await post('/api/youtube/settings', {...options, cookie: 'never-store'}, auth)).status, 409);
    assert.equal((await post('/api/video/youtube', {trackKey: track.trackKey, video: 'dQw4w9WgXcQ'}, auth)).status, 200);
    const notAllowed = await get('/api/video'); assert.equal(notAllowed.source, 'youtube'); assert.equal(notAllowed.consent, false);
    const allowed = await post('/api/youtube/settings', {...options, consent: true}, auth); assert.equal(allowed.status, 200); assert.match(allowed.headers.get('Cache-Control'), /no-store/);
    assert.equal((await get('/api/video')).consent, true);
    const after = await get('/api/state'); assert.equal(after.playback.playing, before.playback.playing); assert.equal(after.playback.volume, before.playback.volume); assert.equal(after.device.amplifierEnabled, before.device.amplifierEnabled);
    await post('/api/event', {type: 'next'}); assert.equal((await post('/api/video/youtube', {trackKey: track.trackKey, video: 'dQw4w9WgXcQ'}, auth)).status, 409);
    const current = await get('/api/youtube/settings'); await post('/api/youtube/settings', {...current, consent: false}, auth); assert.equal((await get('/api/state')).youtube.consent, false);
    assert.equal((await post('/api/security/set-pin', {pin: '849261', confirmation: '849261'}, auth)).status, 200);
    assert.equal((await post('/api/youtube/settings', {...await get('/api/youtube/settings'), consent: true}, auth)).status, 423);
    const newTrack = await get('/api/video'); assert.equal((await post('/api/video/youtube', {trackKey: newTrack.trackKey, video: 'dQw4w9WgXcQ'}, auth)).status, 423);
    assert.equal((await get('/api/health')).ok, true);
  } finally {if (child.exitCode === null) {child.kill('SIGTERM'); await new Promise(r => child.once('exit', r));} rmSync(directory, {recursive: true, force: true});}
});
