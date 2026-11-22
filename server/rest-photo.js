/**
 * The owner's own screen-rest photo. A paired phone sends a JPEG it has already resized (the phone's canvas
 * drops EXIF and location data). It waits as "pending" until someone accepts it on TuneBox itself, so a
 * party guest cannot put a picture on the wall unasked. One current photo, one pending photo.
 */
import {existsSync,readFileSync,renameSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
export const restPhotoLimits=Object.freeze({bytes:3*1024*1024,nameLength:40});
const jpeg=buffer=>Buffer.isBuffer(buffer)&&buffer.length>256&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff;
/** Removes APP1 (EXIF/XMP) segments in case a client did not re-encode. */
export function stripJpegMetadata(buffer){
 if(!jpeg(buffer))throw Error('Send a JPEG photo');
 const parts=[buffer.subarray(0,2)];let i=2;
 while(i+4<=buffer.length){
  if(buffer[i]!==0xff)throw Error('This photo could not be read');
  const marker=buffer[i+1];
  if(marker===0xda){parts.push(buffer.subarray(i));return Buffer.concat(parts);} // start of scan: the rest is image data
  const length=buffer.readUInt16BE(i+2);if(length<2||i+2+length>buffer.length)throw Error('This photo could not be read');
  if(marker!==0xe1&&marker!==0xed&&marker!==0xfe)parts.push(buffer.subarray(i,i+2+length)); // drop EXIF/XMP, IPTC and comments
  i+=2+length;
 }
 throw Error('This photo could not be read');
}
export class RestPhoto{
 constructor(directory,{now=Date.now}={}){this.directory=directory;this.now=now;this.metaPath=join(directory,'rest-photo.json');this.meta=this.load();}
 load(){try{const v=JSON.parse(readFileSync(this.metaPath,'utf8'));return {current:v.current&&existsSync(this.path('current'))?{revision:Number(v.current.revision)||1}:null,pending:v.pending&&existsSync(this.path('pending'))?{revision:Number(v.pending.revision)||1,from:String(v.pending.from||'').slice(0,restPhotoLimits.nameLength),at:Number(v.pending.at)||0}:null};}catch{return {current:null,pending:null};}}
 path(which){return join(this.directory,which==='pending'?'rest-photo-pending.jpg':'rest-photo.jpg');}
 save(){writeFileSync(this.metaPath+'.tmp',JSON.stringify(this.meta)+'\n',{mode:0o600});renameSync(this.metaPath+'.tmp',this.metaPath);}
 status(){return {current:this.meta.current?{revision:this.meta.current.revision}:null,pending:this.meta.pending?{revision:this.meta.pending.revision,from:this.meta.pending.from}:null};}
 upload(buffer,from='Phone'){
  if(!Buffer.isBuffer(buffer)||!buffer.length)throw Error('Send a JPEG photo');
  if(buffer.length>restPhotoLimits.bytes)throw Error('This photo is too large');
  const clean=stripJpegMetadata(buffer),path=this.path('pending');
  writeFileSync(path+'.tmp',clean,{mode:0o600});renameSync(path+'.tmp',path);
  this.meta.pending={revision:(this.meta.pending?.revision||this.meta.current?.revision||0)+1,from:String(from||'Phone').slice(0,restPhotoLimits.nameLength),at:this.now()};this.save();
  return this.status();
 }
 act(action){
  if(action==='accept'){if(!this.meta.pending)throw Error('No photo is waiting');renameSync(this.path('pending'),this.path('current'));this.meta.current={revision:this.meta.pending.revision};this.meta.pending=null;}
  else if(action==='discard'){rmSync(this.path('pending'),{force:true});this.meta.pending=null;}
  else if(action==='remove'){rmSync(this.path('current'),{force:true});this.meta.current=null;}
  else throw Error('Unknown photo action');
  this.save();return this.status();
 }
 file(which){const path=this.path(which);if(!(which==='pending'?this.meta.pending:this.meta.current)||!existsSync(path))return null;return {path,size:statSync(path).size};}
}
