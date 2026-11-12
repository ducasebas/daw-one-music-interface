import {mkdirSync,readFileSync,writeFileSync,appendFileSync,statSync,renameSync,rmSync} from 'node:fs';
import {join} from 'node:path';
/** Explicit fields only. Never store request bodies, tokens, headers, SSIDs or audio. */
export class DebugLog{
 constructor(directory,{maxBytes=524288,now=Date.now}={}){this.directory=join(directory,'debug');this.path=join(this.directory,'events.jsonl');this.maxBytes=maxBytes;this.now=now;this.enabled=false;this.startedAt=null;mkdirSync(this.directory,{recursive:true,mode:0o700});}
 status(){if(this.enabled&&this.now()-Date.parse(this.startedAt)>1800000)this.enabled=false;return {enabled:this.enabled,startedAt:this.startedAt,maxBytes:this.maxBytes*2,downloadAvailable:this.read().length>0};}
 set(enabled){if(typeof enabled!=='boolean')throw Error('Choose debug on or off');this.enabled=enabled;if(enabled){this.startedAt=new Date(this.now()).toISOString();this.record('debug','started');}return this.status();}
 record(component,result,metrics={}){if(!this.enabled||this.now()-Date.parse(this.startedAt)>1800000){this.enabled=false;return;}const clean=s=>typeof s==='string'&&/^[a-zA-Z0-9 _.:/-]{1,80}$/.test(s)?s:'redacted';const numbers=Object.fromEntries(Object.entries(metrics).filter(([k,v])=>/^[a-zA-Z]{1,32}$/.test(k)&&(typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))));const line=JSON.stringify({at:new Date(this.now()).toISOString(),component:clean(component),result:clean(result),metrics:numbers})+'\n';try{if(statSync(this.path).size+line.length>this.maxBytes){rmSync(this.path+'.1',{force:true});renameSync(this.path,this.path+'.1');}}catch{}appendFileSync(this.path,line,{mode:0o600});}
 read(){let lines=[];for(const p of [this.path+'.1',this.path]){try{const raw=readFileSync(p,'utf8');if(raw.length<=this.maxBytes+2048)lines.push(...raw.trim().split('\n').filter(Boolean).map(s=>JSON.parse(s)));}catch{}}return lines.slice(-2000);}
 clear(){rmSync(this.path,{force:true});rmSync(this.path+'.1',{force:true});return this.status();}
}
