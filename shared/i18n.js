import english from './locales/en.json' with { type:'json' };
import dutch from './locales/nl.json' with { type:'json' };
import aliases from './locales/source-aliases.json' with { type:'json' };
export const languages=[{id:'en',name:'English'},{id:'nl',name:'Nederlands'}];
const listeners=new Set();
const cache=new Map();
const fragments=Object.entries(aliases).filter(([key])=>key.length>=8).sort((a,b)=>b[0].length-a[0].length);
let language='en';
try { const saved=globalThis.localStorage?.getItem('tunebox-language'); if(languages.some(l=>l.id===saved))language=saved; } catch {}
if(globalThis.document)document.documentElement.lang=language;
export const getLanguage=()=>language;
export function setLanguage(value){
  if(!languages.some(l=>l.id===value))throw Error('Unsupported language');
  language=value;
  cache.clear();
  try{globalThis.localStorage?.setItem('tunebox-language',value);}catch{}
  if(globalThis.document)document.documentElement.lang=value;
  listeners.forEach(fn=>fn());
}
export function subscribeLanguage(fn){listeners.add(fn);return()=>listeners.delete(fn);}
export function translate(value,locale=language){
  if(typeof value!=='string')return value;
  const source=value.replace(/\s+/g,' ').trim(),key=aliases[source]||source;
  const result=(locale==='nl'?dutch:english)[key]??english[key];
  if(result===undefined){
    if(!/[a-zA-Z]/.test(value))return value;
    const cacheKey=locale+'\0'+value;
    if(cache.has(cacheKey))return cache.get(cacheKey);
    let composed=value;
    if(locale==='en')for(const [from,to] of fragments)if(composed.includes(from))composed=composed.split(from).join(to);
    if(cache.size>=512)cache.clear();cache.set(cacheKey,composed);
    return composed;
  }
  return value.match(/^\s*/)[0]+result+value.match(/\s*$/)[0];
}
export const tr=translate;
export function translateFormat(key,values={},locale=language){return String(translate(key,locale)).replace(/\{([a-zA-Z0-9_]+)\}/g,(all,k)=>Object.hasOwn(values,k)?String(values[k]):all);}
