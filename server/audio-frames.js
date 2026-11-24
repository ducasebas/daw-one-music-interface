import {performance} from 'node:perf_hooks';
import {snapshotWriter} from './event-stream.js';

export const audioFrameIntervalMs=50;
/** Local analysis values only. A stream never renews the PCM lease by itself. */
export class AudioFrames{
 constructor({read,now=()=>performance.now(),maxClients=4}){Object.assign(this,{read,now,maxClients});this.clients=new Map();this.writer=snapshotWriter();this.timer=null;}
 add(request,response){
  if(this.clients.size>=this.maxClients){response.statusCode=429;response.end();return;}
  response.setHeader('Content-Type','text/event-stream; charset=utf-8');response.setHeader('Cache-Control','no-store');response.setHeader('Connection','keep-alive');response.setHeader('X-Accel-Buffering','no');response.flushHeaders();
  this.clients.set(response,{body:null,at:0});
  const remove=()=>{this.clients.delete(response);this.writer.remove(response);if(!this.clients.size){clearInterval(this.timer);this.timer=null;}};
  response.once('close',remove);
  this.send();
  if(!this.timer){this.timer=setInterval(()=>this.send(),audioFrameIntervalMs);this.timer.unref();}
 }
 send(){
  let body;try{body='data: '+JSON.stringify(this.read())+'\n\n';}catch{return;}
  if(body.length>16384)return;
  const now=this.now();
  for(const [response,last] of this.clients){
   if(response.destroyed||response.writableEnded){this.clients.delete(response);this.writer.remove(response);continue;}
   if(body===last.body&&now-last.at<1000)continue;
   last.body=body;last.at=now;this.writer.write(response,body);
  }
  if(!this.clients.size){clearInterval(this.timer);this.timer=null;}
 }
 close(){clearInterval(this.timer);this.timer=null;for(const response of this.clients.keys())response.end();this.clients.clear();}
}
