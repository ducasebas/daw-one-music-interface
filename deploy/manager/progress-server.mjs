import {randomBytes} from 'node:crypto';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
export function createProgressServer({getStatus,isAppReady,frameReady=()=>{}}){
 const frameToken=randomBytes(24).toString('hex');
 const html=readFileSync(new URL('./progress.html',import.meta.url),'utf8').replaceAll('__TUNEBOX_FRAME_TOKEN__',frameToken);
 const assets=new Map(['appliance.js','appliance.css'].map(name=>['/'+name,readFileSync(new URL('../../public/'+name,import.meta.url))]));
 return createServer(async(request,response)=>{
  response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'");
  response.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), display-capture=(), fullscreen=()');
  const path=new URL(request.url,'http://localhost').pathname;
  if(path==='/frame-ready'&&request.method==='POST'){if(request.headers['x-tunebox-frame']!==frameToken){response.writeHead(403).end();return;}try{await frameReady();response.writeHead(204).end();}catch{response.writeHead(503).end();}return;}
  if(request.method==='GET'&&assets.has(path)){response.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':'text/css');response.end(assets.get(path));return;}
  if(request.method!=='GET'||!['/','/status'].includes(path)){response.writeHead(404).end();return;}
  if(path==='/'){response.setHeader('Content-Type','text/html; charset=utf-8');response.end(html);return;}
  try{response.setHeader('Content-Type','application/json');response.end(JSON.stringify({...await getStatus(),appReady:await isAppReady()}));}catch{response.writeHead(503).end();}
 });
}
