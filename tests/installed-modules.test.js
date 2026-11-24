import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync,mkdirSync,copyFileSync,existsSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {missingImports} from '../deploy/manager/check-imports.mjs';
/**
 * Rebuild the host trees exactly as the install scripts copy them (from their `install -m 644 "$repo"/...` lines) and
 * check that every module they import is installed. GUI 3.16.2 failed on the Pi because root-adapter.mjs imported
 * ssh.mjs, which install-manager.sh did not copy; this test would have caught it.
 */
const scripts=readdirSync('deploy').filter(n=>/^install.*\.sh$/.test(n));
function expand(spec){
 const brace=spec.match(/^(.*)\{([^}]+)\}(.*)$/);if(brace)return brace[2].split(',').flatMap(x=>expand(brace[1]+x+brace[3]));
 if(spec.includes('*')){const dir=dirname(spec),pattern=new RegExp('^'+basename(spec).replace(/\./g,'\\.').replace(/\*/g,'.*')+'$');return readdirSync(dir).filter(n=>pattern.test(n)).map(n=>join(dir,n));}
 return [spec];
}
function tree(targets){
 const root=mkdtempSync(join(tmpdir(),'tunebox-host-'));
 for(const script of scripts)for(const line of readFileSync(join('deploy',script),'utf8').split('\n')){
  const m=line.match(/^\s*install -m [0-7]+ (.+) "?\$(base|stage)\/([^"]*)"?\s*$/);if(!m)continue;
  const dest=m[3].replace(/\/$/,'');
  const sources=[...m[1].matchAll(/"\$repo"\/(\S+)/g)].flatMap(x=>expand(x[1].replace(/"/g,'')));
  for(const src of sources){if(!existsSync(src))continue;const target=dest.includes('.')&&sources.length===1?join(root,dest):join(root,dest,basename(src));mkdirSync(dirname(target),{recursive:true});copyFileSync(src,target);}
 }
 writeFileSync(join(root,'package.json'),'{"type":"module"}\n');return root;
}
test('every module imported by the installed root manager, Bluetooth, measurement, sync and power code is installed',()=>{
 const root=tree();
 try{
  const entries=['deploy/manager','deploy/bluetooth','deploy/measurement','deploy/sync'].flatMap(d=>existsSync(join(root,d))?readdirSync(join(root,d)).filter(n=>n.endsWith('.mjs')).map(n=>join(d,n)):[]);
  assert.ok(entries.includes('deploy/manager/service.mjs'));
  assert.deepEqual(missingImports(root,entries),[]);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('the updater directory has every module update.mjs imports',()=>{
 const root=mkdtempSync(join(tmpdir(),'tunebox-updater-'));
 try{
  const ota=readFileSync('deploy/install-ota.sh','utf8');
  const list=ota.match(/"\$repo"\/deploy\/ota\/\{([^}]+)\} "\$stage\/"/)[1].split(',');
  for(const f of list)copyFileSync(join('deploy/ota',f),join(root,f));
  assert.match(ota,/"\$repo\/shared\/update-settings\.js" "\$stage\/settings\.mjs"/);copyFileSync('shared/update-settings.js',join(root,'settings.mjs'));
  writeFileSync(join(root,'package.json'),'{"type":"module"}\n');
  assert.deepEqual(missingImports(root,['update.mjs']),[]);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('the import check reports a missing manager module (the 3.16.2 failure)',()=>{
 const root=mkdtempSync(join(tmpdir(),'tunebox-missing-'));
 try{mkdirSync(join(root,'m'));writeFileSync(join(root,'m/a.mjs'),"import {x} from './b.mjs';\nexport const y=1;\n");assert.deepEqual(missingImports(root,['m/a.mjs']),['m/b.mjs']);}
 finally{rmSync(root,{recursive:true,force:true});}
});
test('3.16.3: the updater unit restores the previous version straight after a failed or killed run, and the run has its own time limit',()=>{
 const ota=readFileSync('deploy/install-ota.sh','utf8'),update=readFileSync('deploy/ota/update.mjs','utf8');
 assert.match(ota,/ExecStopPost=\/bin\/sh -c 'if \[ "\$\$SERVICE_RESULT" != success \] && \[ -f \/var\/lib\/daw-one-updater\/pending\.json \]; then exec \/usr\/bin\/flock -w 30 \/run\/daw-one-update\.lock \/usr\/bin\/node \/usr\/local\/lib\/daw-one-updater\/update\.mjs --recover; fi'/);
 assert.match(ota,/TimeoutStopSec=4min/);
 assert.match(update,/const watchdog=setTimeout\(\(\)=>\{report\('error',.*process\.exit\(1\);\},9\*60000\);watchdog\.unref\(\);/);
 // The recovery path runs before anything else when the activation journal exists.
 assert.ok(update.indexOf("existsSync(base+'/pending.json')")<update.indexOf("process.argv.includes('--recover')"));
});
test('3.16.3: installing the manager stages it, checks its imports and waits until it answers',()=>{
 const s=readFileSync('deploy/install-manager.sh','utf8');
 assert.match(s,/check-imports\.mjs" "\$stage"/);assert.ok(s.indexOf('check-imports.mjs')<s.indexOf('host-files.py" tree "$stage" "$base"'));
 assert.match(s,/http:\/\/127\.0\.0\.1:3002\/status/);assert.match(s,/install -m 644 "\$repo"\/deploy\/manager\/\*\.mjs/);
});
