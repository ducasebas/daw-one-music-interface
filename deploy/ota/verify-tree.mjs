import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const roots=['dist','server','shared','deploy','docs','package.json','package-lock.json','LICENSE','THIRD_PARTY_NOTICES.md'];
export function verifyTree(root,release){
 const raw=readFileSync(join(root,'release-manifest.json'),'utf8');if(raw.length>1048576)throw Error('Manifest too large');const m=JSON.parse(raw);
 if(m.schema!==1||m.release!==release||!Array.isArray(m.files)||!m.files.length||m.files.length>4000)throw Error('Invalid release inventory');
 const paths=[];const walk=(relative)=>{const p=join(root,relative),s=lstatSync(p);if(s.isSymbolicLink())throw Error('Symlink in signed payload');if(s.isDirectory())for(const n of readdirSync(p))walk(relative+'/'+n);else if(s.isFile())paths.push(relative);else throw Error('Special file in payload');};roots.forEach(walk);
 const entries=new Map(m.files.map(f=>[f.path,f.sha256]));if(entries.size!==m.files.length||paths.length!==entries.size||paths.some(p=>!entries.has(p)))throw Error('Inventory mismatch');
 for(const p of paths)if(createHash('sha256').update(readFileSync(join(root,p))).digest('hex')!==entries.get(p))throw Error('Payload hash mismatch');
 const js=paths.filter(p=>p.startsWith('dist/assets/')&&p.endsWith('.js'));if(!js.some(p=>readFileSync(join(root,p),'utf8').includes(release)))throw Error('Frontend release mismatch');return m;
}
