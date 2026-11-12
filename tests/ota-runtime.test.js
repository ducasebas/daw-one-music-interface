import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,statSync,symlinkSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {prepareRuntime} from '../deploy/ota/prepare-runtime.mjs';

test('OTA dependencies created under private umask become readable by the app without world write or external-link changes', {skip:process.platform!=='linux'},()=>{
  const root=mkdtempSync(join(tmpdir(),'tunebox-runtime-'));
  try{
    const dest=join(root,'candidate'),source=join(root,'fixture'),outside=join(root,'outside');
    mkdirSync(dest);mkdirSync(source);mkdirSync(outside,{mode:0o700});
    writeFileSync(join(source,'package.json'),JSON.stringify({name:'tunebox-runtime-fixture',version:'1.0.0',main:'index.js'}));
    writeFileSync(join(source,'index.js'),'module.exports = 42;\n',{mode:0o644});
    execFileSync('tar',['-czf',join(dest,'fixture.tgz'),'--transform=s,^,package/,','-C',source,'package.json','index.js']);
    writeFileSync(join(dest,'package.json'),JSON.stringify({name:'tunebox-runtime-install',version:'1.0.0',dependencies:{'tunebox-runtime-fixture':'file:fixture.tgz'}}));
    // Keep this test offline: its only dependency is a locally packed fixture.
    const npm=process.env.npm_execpath;
    assert.ok(npm,'Run through npm test so the tested npm executable is known');
    const env={...process.env,NPM_CONFIG_CACHE:join(root,'cache'),NPM_CONFIG_OFFLINE:'true'};
    execFileSync(process.execPath,[npm,'install','--prefix',dest,'--package-lock-only','--ignore-scripts','--no-audit','--no-fund'],{env,stdio:'pipe'});
    const external=join(outside,'private');writeFileSync(external,'outside\n',{mode:0o600});
    let modesBefore;
    prepareRuntime(dest,(command,args)=>{
      if(command==='chown')return; // The integration test does not need root.
      if(command==='runuser'){
        const tail=args.slice(args.indexOf('npm')+1);
        execFileSync(process.execPath,['--input-type=module','-e',
          'import {spawnSync} from "node:child_process";process.umask(0o077);const r=spawnSync(process.execPath,process.argv.slice(1),{stdio:"inherit"});process.exit(r.status??1);',
          npm,...tail],{env,stdio:'pipe'});
        const dependency=join(dest,'node_modules','tunebox-runtime-fixture');
        modesBefore=[statSync(dependency).mode&0o777,statSync(join(dependency,'index.js')).mode&0o777];
        symlinkSync(outside,join(dest,'node_modules','outside-link'));
        writeFileSync(join(dest,'runtime-tool'),'#!/bin/sh\n',{mode:0o777});
        return;
      }
      execFileSync(command,args,{stdio:'pipe'});
    });
    assert.deepEqual(modesBefore,[0o700,0o600]);
    const dependency=join(dest,'node_modules','tunebox-runtime-fixture');
    assert.equal(statSync(dependency).mode&0o777,0o755);
    assert.equal(statSync(join(dependency,'index.js')).mode&0o777,0o644);
    assert.equal(statSync(join(dest,'runtime-tool')).mode&0o777,0o755);
    assert.equal(statSync(outside).mode&0o777,0o700);
    assert.equal(statSync(external).mode&0o777,0o600);
    assert.match(readFileSync(join(dependency,'index.js'),'utf8'),/42/);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('failed dependency installation never reaches runtime promotion',()=>{
  const calls=[];
  assert.throws(()=>prepareRuntime('/candidate',(command,args)=>{
    calls.push([command,args]);if(command==='runuser')throw Error('install failed');
  }),/install failed/);
  assert.equal(calls.some(([command,args])=>command==='chown'&&args.includes('root:root')),false);
  assert.equal(calls.some(([command])=>command==='chmod'),false);
});
