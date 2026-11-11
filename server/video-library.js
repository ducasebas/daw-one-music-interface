import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,renameSync,readdirSync,statSync,statfsSync,unlinkSync,createWriteStream,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
const LIMIT=96*1024*1024,QUOTA=256*1024*1024;
const validId=id=>typeof id==='string'&&/^[a-f0-9]{32}\.(mp4|webm)$/.test(id);
export function videoTrackKey(track){return /^[a-f0-9]{64}$/.test(track?.mediaKey||'')?track.mediaKey:createHash('sha256').update(JSON.stringify([track?.title||'',track?.artist||'',track?.album||''])).digest('hex');}
export class VideoLibrary {
  constructor(directory){this.directory=resolve(directory,'video-artwork');this.busy=false;}
  entries(){try{const raw=readFileSync(join(this.directory,'links.json'),'utf8');if(raw.length>65536)throw Error();const entries=JSON.parse(raw);return entries&&typeof entries==='object'&&!Array.isArray(entries)?entries:{};}catch{return {};}}
  save(entries){mkdirSync(this.directory,{recursive:true,mode:0o700});const p=join(this.directory,'links.json');writeFileSync(p+'.tmp',JSON.stringify(entries)+'\n',{mode:0o600});renameSync(p+'.tmp',p);}
  get(track){const key=videoTrackKey(track),entry=this.entries()[key];return {trackKey:key,available:validId(entry?.id)&&existsSync(join(this.directory,entry.id)),url:validId(entry?.id)?'/api/video/file/'+entry.id:null,linkedAt:entry?.linkedAt||null,maxBytes:LIMIT};}
  path(id){if(!validId(id)||!Object.values(this.entries()).some(e=>e.id===id))return null;return join(this.directory,id);}
  remove(track){if(this.busy)throw Error('A video upload is in progress');const entries=this.entries(),key=videoTrackKey(track),id=entries[key]?.id;delete entries[key];this.save(entries);if(validId(id))try{unlinkSync(join(this.directory,id));}catch{};return {removed:true};}
  async upload(stream,track,type,length){
    if(this.busy)throw Error('A video upload is already in progress');
    if(!['video/mp4','video/webm'].includes(type))throw Error('Choose an MP4 or WebM video');
    if(!track||track.id==='none'||!Number.isFinite(track.duration))throw Error('Select a track with a known duration before linking a video');
    const announced=Number(length);if(announced>LIMIT)throw Error('Video exceeds the 96 MB limit');
    this.busy=true;let path;
    try{
      mkdirSync(this.directory,{recursive:true,mode:0o700});
      const disk=statfsSync(this.directory);if(disk.bavail*disk.bsize<Math.max(announced||LIMIT,32*1024*1024)+32*1024*1024)throw Error('Not enough free storage for this video');
      const used=readdirSync(this.directory).filter(validId).reduce((sum,id)=>sum+statSync(join(this.directory,id)).size,0);
      const id=randomUUID().replaceAll('-','')+(type==='video/mp4'?'.mp4':'.webm');path=join(this.directory,id+'.upload');
      let bytes=0,prefix=Buffer.alloc(0),checked=false;
      const guard=new Transform({transform(chunk,_encoding,done){
        bytes+=chunk.length;
        if(bytes>LIMIT||used+bytes>QUOTA)return done(Error('Video storage limit reached'));
        if(!checked){prefix=Buffer.concat([prefix,chunk.subarray(0,16-prefix.length)]);if(prefix.length>=12){checked=true;const correct=type==='video/mp4'?prefix.toString('ascii',4,8)==='ftyp':prefix.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));if(!correct)return done(Error('The file is not a supported video container'));}}
        done(null,chunk);
      }});
      await pipeline(stream,guard,createWriteStream(path,{flags:'wx',mode:0o600}));
      if(!checked||bytes<32)throw Error('Incomplete video file');
      const entries=this.entries(),key=videoTrackKey(track),old=entries[key]?.id;
      if(!Object.hasOwn(entries,key)&&Object.keys(entries).length>=64)throw Error('Remove an old video link before adding another');
      renameSync(path,join(this.directory,id));path=join(this.directory,id);
      entries[key]={id,linkedAt:new Date().toISOString(),bytes};this.save(entries);path=null;
      if(validId(old))try{unlinkSync(join(this.directory,old));}catch{}
      return this.get(track);
    }finally{this.busy=false;if(path)try{unlinkSync(path);}catch{}}
  }
}
