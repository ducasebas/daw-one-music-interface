import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
export function createProgressServer({getStatus,isAppReady}){
 const html=readFileSync(new URL('./progress.html',import.meta.url));
 return createServer(async(request,response)=>{
  response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'");
  const path=new URL(request.url,'http://localhost').pathname;
  if(request.method!=='GET'||!['/','/status'].includes(path)){response.writeHead(404).end();return;}
  if(path==='/'){response.setHeader('Content-Type','text/html; charset=utf-8');response.end(html);return;}
  try{response.setHeader('Content-Type','application/json');response.end(JSON.stringify({...await getStatus(),appReady:await isAppReady()}));}catch{response.writeHead(503).end();}
 });
}
