/** A token belongs to one server endpoint. Moving to another LAN host is not consent to share it. */
export function musicEndpoint(value){
 try{const u=new URL(value);if(!['http:','https:','ws:','wss:'].includes(u.protocol)||u.username||u.password||u.search||u.hash||!['/','/ws'].includes(u.pathname))return null;const secure=['https:','wss:'].includes(u.protocol);return `${secure?'wss':'ws'}://${u.hostname.toLowerCase()}:${u.port||(secure?'443':'80')}/ws`;}catch{return null;}
}
export function environmentValue(text,key){
 const rows=String(text).split(/\r?\n/).filter(row=>row.startsWith(key+'='));let value=rows.at(-1)?.slice(key.length+1).trim()||'';
 if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
 return value;
}
export function musicToken({url,token,currentUrl,storedToken}){
 if(token)return token;
 const next=musicEndpoint(url);return next&&next===musicEndpoint(currentUrl)?storedToken||'':'';
}
