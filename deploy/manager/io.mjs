import {readFileSync,writeFileSync,renameSync,openSync,fsyncSync,closeSync} from 'node:fs';
export function readJson(path,fallback){try{const s=readFileSync(path,'utf8');if(s.length>32768)throw Error();return JSON.parse(s);}catch{return fallback;}}
export function atomicJson(path,value,mode=0o600){
 const tmp=path+'.tmp';const fd=openSync(tmp,'w',mode);
 try{writeFileSync(fd,JSON.stringify(value)+'\n');fsyncSync(fd);}finally{closeSync(fd);}
 renameSync(tmp,path);
}
export async function boundedJson(response,limit=262144){if(!response.ok)throw Error('Backend unavailable');let size=0;const chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>limit)throw Error('Response too large');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks));}
