import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {selectRelease,releaseIsCurrent} from '../deploy/ota/releases.mjs';
import {repository} from '../deploy/ota/policy.mjs';
const keys=generateKeyPairSync('ed25519');
function release(sequence,commit,changes={}){
 const manifest={schema:1,repository,channel:'preview',sequence,commit,release:'build-'+sequence,bytes:1,sha256:'a'.repeat(64),...changes};
 const raw=Buffer.from(JSON.stringify(manifest));
 return {manifest,raw,signature:Buffer.from(sign(null,raw,keys.privateKey).toString('base64')),tag_name:'ota-preview-'+commit,draft:false};
}
function fixture(items){
 const calls=[];
 return {calls,channel:'preview',key:keys.publicKey,download:async(url,limit)=>{
  calls.push({url,limit});
  const item=items.find(i=>url.includes('/'+i.tag_name+'/'));
  if(!item)throw Error('Missing fixture');
  return url.endsWith('.sig')?item.signature:item.raw;
 }};
}
test('OTA finds the newer signed release below the installed release in every API order',async()=>{
 const old=release(43230269632,'dbeef5c8e2e2557b0891516d74d77a9967fdd683');
 const next=release(43239793494,'b69e7513682daecbdceeb38797fc8a2f703dbd0f');
 const oldest=release(43227271500,'75c388c3e538425104ce8ab739d8c2b4b77a4782');
 for(const list of [[old,next,oldest],[oldest,old,next],[next,oldest,old]]){
  // Misleading dates and draft order must not override the signed sequence.
  const options=fixture(list),selected=await selectRelease(list.map(i=>({...i,published_at:i===old?'2099-01-01':'2000-01-01'})),options);
  assert.equal(selected.manifest.commit,next.manifest.commit);
  assert.equal(releaseIsCurrent(selected,old.manifest),false);
  assert.equal(releaseIsCurrent(selected,next.manifest),true);
  assert.equal(options.calls.length,6);
  assert.ok(options.calls.every(c=>c.url.startsWith('https://github.com/'+repository+'/releases/download/ota-preview-')));
 }
});
test('drafts, other channels and arbitrary asset links never become install candidates',async()=>{
 const good=release(5,'a'.repeat(40)),draft={...release(100,'b'.repeat(40)),draft:true};
 const other={...release(200,'c'.repeat(40)),tag_name:'ota-stable-'+'c'.repeat(40)};
 const options=fixture([good]);const selected=await selectRelease([draft,other,{tag_name:'other',draft:false},null,{...good,assets:[{browser_download_url:'https://untrusted.invalid/archive'}]}],options);
 assert.equal(selected.manifest.sequence,5);assert.equal(options.calls.length,2);
 assert.equal(await selectRelease([draft,other],options),null);
});
test('invalid signatures and tag mismatches cannot outrank a verified update or produce a false current status',async()=>{
 const good=release(5,'a'.repeat(40)),bad=release(100,'b'.repeat(40)),mismatch=release(200,'c'.repeat(40),{commit:'d'.repeat(40)});
 bad.signature=Buffer.from('invalid');
 const selection=await selectRelease([bad,good,mismatch],fixture([bad,good,mismatch]));
 assert.equal(selection.manifest.sequence,5);assert.equal(selection.failures.length,2);
 assert.equal(releaseIsCurrent(selection,{sequence:4,commit:'e'.repeat(40)}),false);
 assert.throws(()=>releaseIsCurrent(selection,good.manifest),/check incomplete/);
 await assert.rejects(selectRelease([bad,mismatch],fixture([bad,mismatch])),/could be verified/);
});
test('an unreachable release cannot yield up-to-date; explicit reinstall after rollback remains possible',async()=>{
 const good=release(5,'a'.repeat(40)),unreachable=release(6,'b'.repeat(40));
 const selection=await selectRelease([good,unreachable],fixture([good]));
 assert.throws(()=>releaseIsCurrent(selection,good.manifest),/check incomplete/);
 const complete=await selectRelease([good],fixture([good]));
 assert.equal(releaseIsCurrent(complete,{sequence:5,commit:'c'.repeat(40)}),false);
 assert.equal(releaseIsCurrent(complete,{sequence:6,commit:'c'.repeat(40)}),true);
});
test('conflicting highest signed sequences and malformed inventories fail explicitly',async()=>{
 const a=release(5,'a'.repeat(40)),b=release(5,'b'.repeat(40));
 await assert.rejects(selectRelease([a,b],fixture([a,b])),/Conflicting/);
 await assert.rejects(selectRelease({},fixture([])),/Invalid/);
 await assert.rejects(selectRelease(Array(101).fill(a),fixture([a])),/Invalid/);
});
