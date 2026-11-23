#!/usr/bin/env node
/**
 * Static check before the root manager is replaced: every relative import reachable from the entry files must
 * exist in the given directory tree. A missing module (as with ssh.mjs in GUI 3.16.2) would otherwise make the
 * manager, and the update progress page inside it, fail to start. No code is executed.
 */
import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve,relative} from 'node:path';
export function missingImports(root,entries){
 const seen=new Set(),missing=[];const queue=entries.map(e=>resolve(root,e));
 while(queue.length){
  const file=queue.pop();if(seen.has(file))continue;seen.add(file);
  if(!existsSync(file)){missing.push(relative(root,file));continue;}
  const text=readFileSync(file,'utf8');
  for(const m of text.matchAll(/(?:^|[\s;])(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)){
   const spec=m[1]||m[2];queue.push(resolve(dirname(file),spec));
  }
 }
 return [...new Set(missing)].sort();
}
if(import.meta.url===`file://${process.argv[1]}`){
 const [root,...entries]=process.argv.slice(2);
 const missing=missingImports(root,entries.length?entries:['deploy/manager/service.mjs']);
 if(missing.length){console.error('Manager modules missing: '+missing.join(', '));process.exit(1);}
 console.log('Manager modules complete');
}
