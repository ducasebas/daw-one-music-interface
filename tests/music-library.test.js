import { test } from "node:test";
import assert from "node:assert/strict";
import { MusicLibrary } from "../server/music-library.js";
import { ArtworkCache, artworkUrl } from "../server/artwork.js";
import { mediaImage } from "../shared/media.js";
const imageId = "a".repeat(64);
const album = {
  media_type: "album",
  item_id: "1",
  provider: "library",
  uri: "library://album/1",
  name: "Album",
  artists: [{ name: "Artist" }],
  metadata: { images: [{ type: "thumb", proxy_id: imageId }] },
  available: true,
};
function fixture() {
  const calls = [];
  const s = {
    status: "connected",
    playerId: "pi",
    queueId: "queue",
    players: [{ player_id: "pi", available: true }],
    playback: { connected: true, volume: 20 },
    config: { controlEnabled: true, volumeLimit: 40 },
    refresh: async () => {},
    transport: {
      command: async (c, a) => {
        calls.push([c, a]);
        return [album, album, album, album];
      },
    },
  };
  return { s, calls, lib: new MusicLibrary(s) };
}
test("bounded library pages hide provider URI and expose safe thumbnail IDs", async () => {
  const { lib, calls } = fixture();
  const page = await lib.browse({ kind: "albums", offset: 0 });
  assert.equal(page.items.length, 3);
  assert.equal(page.hasMore, true);
  assert.equal(page.items[0].artwork, `/api/artwork/${imageId}`);
  assert.equal(JSON.stringify(page).includes("library://"), false);
  assert.deepEqual(calls[0], [
    "music/albums/library_items",
    { limit: 4, offset: 0 },
  ]);
  await lib.browse({ kind: "albums" });
  assert.equal(calls.length, 1);
});
test('favorites use registered server items and clear catalogue cache after acknowledgement',async()=>{
 const {lib,calls,s}=fixture();const page=await lib.browse({});await lib.favorite(page.items[0].id,true);assert.deepEqual(calls.at(-1),['music/favorites/add_item',{item:album.uri}]);assert.equal(lib.pages.size,0);
 await lib.favorite(page.items[0].id,false);assert.deepEqual(calls.at(-1),['music/favorites/remove_item',{media_type:'album',library_item_id:'1'}]);
 await assert.rejects(lib.favorite('arbitrary-url',true));s.config.controlEnabled=false;await assert.rejects(lib.favorite(page.items[0].id,true));
});
test("media drilldown starts media on the selected player queue rather than its active source", async () => {
  const { lib, calls } = fixture();
  const page = await lib.browse({});
  const id = page.items[0].id;
  await lib.browse({ parent: id });
  assert.equal(calls[1][0], "music/albums/album_tracks");
  await lib.enqueue(id, "next");
  assert.deepEqual(calls[2], [
    "player_queues/play_media",
    { queue_id: "pi", media: album.uri, option: "next" },
  ]);
});
test("read-only, unavailable, over-volume, grouped-child and unregistered items cannot play", async () => {
  for (const mutate of [
    (s) => (s.config.controlEnabled = false),
    (s) => (s.playback.connected = false),
    (s) => (s.playback.volume = 80),
    (s) => (s.players[0].synced_to = "leader"),
  ]) {
    const { s, lib, calls } = fixture();
    const p = await lib.browse({});
    mutate(s);
    await assert.rejects(lib.enqueue(p.items[0].id, "replace"));
    assert.equal(calls.length, 1);
  }
  await assert.rejects(fixture().lib.enqueue("unknown", "replace"));
  await assert.rejects(fixture().lib.browse({ kind: "arbitrary-command" }));
});
test("artwork accepts only opaque IDs and never forwards arbitrary URLs or redirects", async () => {
  assert.throws(() => artworkUrl("http://ma:8095", "http://localhost/secret"));
  assert.equal(
    artworkUrl("http://ma:8095/ws", imageId).pathname,
    `/imageproxy/${imageId}`,
  );
  assert.equal(
    mediaImage({ metadata: { images: [{ path: "https://untrusted/image" }] } }),
    null,
  );
  let count = 0;
  const c = new ArtworkCache(
    { url: "http://ma:8095/ws", token: "private-fixture" },
    async (url, options) => {
      count++;
      assert.equal(options.redirect, "error");
      assert.equal(options.headers.Authorization, "Bearer private-fixture");
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { "Content-Type": "image/webp" },
      });
    },
  );
  assert.equal((await c.get(imageId)).body.length, 3);
  await c.get(imageId);
  assert.equal(count, 1);
  const bad = new ArtworkCache(
    { url: "http://ma" },
    async () =>
      new Response("<svg/>", { headers: { "Content-Type": "image/svg+xml" } }),
  );
  await assert.rejects(bad.get(imageId));
});

test("search combines provider results without sending unknown paging args to MA", async () => {
  const { lib, s, calls } = fixture();
  s.transport.command = async (c, a) => {
    calls.push([c, a]);
    return {
      albums: [album],
      tracks: [{ ...album, media_type: "track", uri: "library://track/1" }],
    };
  };
  const p = await lib.browse({ q: "test" });
  assert.equal(p.items.length, 2);
  assert.equal(calls[0][0], "music/search");
  assert.equal("offset" in calls[0][1], false);
});
test("album drilldown uses version-2.10 arguments and bounds the response", async () => {
  const { lib, s } = fixture();
  const first = await lib.browse({});
  s.transport.command = async (c, args, options) => {
    assert.equal("limit" in args, false);
    assert.equal("offset" in args, false);
    assert.equal(options.maxItems, 1000);
    return [album];
  };
  assert.equal(
    (await lib.browse({ parent: first.items[0].id })).items.length,
    1,
  );
});

test('a known grouped member can start music on the verified group queue without ignoring another room volume',async()=>{
 const {s,lib,calls}=fixture();const page=await lib.browse({});
 s.players[0]={...s.players[0],synced_to:'leader',volume_level:20};s.players.push({player_id:'leader',available:true,group_members:['leader','pi'],volume_level:18});s.queueId='leader';
 await lib.enqueue(page.items[0].id,'replace');assert.deepEqual(calls.at(-1),['player_queues/play_media',{queue_id:'leader',media:album.uri,option:'replace'}]);
 s.players[1].volume_level=75;const before=calls.length;await assert.rejects(()=>lib.enqueue(page.items[0].id,'replace'),/every affected room/);assert.equal(calls.length,before);
});
test('replacing a queue with music waiting needs an explicit choice; next and add never ask',async()=>{
 const {lib,calls,s}=fixture();const page=await lib.browse({});const id=page.items[0].id;
 s.playback.queue=[{id:'now'},{id:'mine'},{id:'theirs'}];
 const before=calls.length;
 await assert.rejects(lib.enqueue(id,'replace'),e=>e.code==='queue-not-empty'&&e.upcoming===2);
 assert.equal(calls.length,before,'nothing was sent to Music Assistant');
 await lib.enqueue(id,'next');assert.equal(calls.at(-1)[1].option,'next');
 await lib.enqueue(id,'add');assert.equal(calls.at(-1)[1].option,'add');
 await lib.enqueue(id,'replace',{confirmReplace:true});assert.equal(calls.at(-1)[1].option,'replace');
 s.playback.queue=[{id:'now'}];await lib.enqueue(id,'replace');assert.equal(calls.at(-1)[1].option,'replace','only the current track: no question');
 s.playback.queue=[{id:'none'}];await lib.enqueue(id,'replace');
});
test('the queue is saved as a Music Assistant playlist from the playing track on',async()=>{
 const {lib,calls,s}=fixture();const answers={'player_queues/get':{current_index:2},'player_queues/items':[{media_item:{uri:'tidal://track/1'}},{uri:'spotify://track/2'},{media_item:{}}],'music/playlists/create_playlist':{item_id:'77'}};
 s.transport.command=async(c,a)=>{calls.push([c,a]);return answers[c];};
 const result=await lib.saveQueue('Party mix');
 assert.deepEqual(result,{saved:2,name:'Party mix'});
 assert.deepEqual(calls.find(c=>c[0]==='player_queues/items')[1],{queue_id:'queue',limit:500,offset:2});
 assert.deepEqual(calls.at(-1),['music/playlists/add_playlist_tracks',{db_playlist_id:'77',uris:['tidal://track/1','spotify://track/2']}]);
 answers['music/playlists/create_playlist']=null;await assert.rejects(lib.saveQueue(),/did not create/);
 answers['player_queues/items']=[];await assert.rejects(lib.saveQueue(),/no tracks/);
 s.config.controlEnabled=false;await assert.rejects(lib.saveQueue(),/read-only/);
});
