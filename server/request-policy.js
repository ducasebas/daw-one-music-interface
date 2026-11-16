import {hostname,networkInterfaces} from 'node:os';

// Trust the address we actually serve, never a caller's Forwarded/Host rewrite.
export function authority(value){
 if(typeof value!=='string'||!value||value.length>300||/[\s/@?#\\]/.test(value))return null;
 try{const u=new URL('http://'+value);if(u.username||u.password||u.pathname!=='/'||!u.hostname)return null;return {host:u.host.toLowerCase(),name:u.hostname.toLowerCase().replace(/^\[|\]$/g,'')};}catch{return null;}
}
export function sameOrigin(request){
 const origin=request.get('Origin');
 if(request.get('Sec-Fetch-Site')==='cross-site')return false;
 if(!origin)return true;
 try{const u=new URL(origin),host=authority(request.get('host'));return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash&&!!host&&u.host.toLowerCase()===host.host;}catch{return false;}
}
export function trustedHost(request,{name=hostname(),interfaces=networkInterfaces(),extra=process.env.DAW_ALLOWED_HOSTS||''}={}){
 const host=authority(request.get('host'));if(!host)return false;
 const allowed=new Set(['localhost','127.0.0.1','::1',name.toLowerCase(),name.toLowerCase()+'.local']);
 for(const rows of Object.values(interfaces))for(const row of rows||[])if(row.address)allowed.add(row.address.toLowerCase().replace(/%.*/,''));
 for(const entry of extra.split(',')){const parsed=authority(entry.trim());if(parsed)allowed.add(parsed.name);}
 if(request.provisioning)allowed.add('10.42.0.1');
 return allowed.has(host.name);
}
export function requestPolicy(request,response,next){
 if(!trustedHost(request))return response.status(403).json({error:'Use the TuneBox device address'});
 if(request.path.startsWith('/api/')&&!sameOrigin(request))return response.status(403).json({error:'Open this action on TuneBox'});
 next();
}
export const applianceCsp="default-src 'self'; script-src 'self' https://www.youtube.com https://s.ytimg.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://www.youtube.com; media-src 'self' blob:; frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";
