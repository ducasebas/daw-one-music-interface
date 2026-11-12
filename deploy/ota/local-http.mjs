import {get} from 'node:http';

/** Updater GETs must survive synchronous npm/systemctl work between requests.
 * A fresh socket also avoids reusing a connection from a stopped app process.
 * No redirects, credentials or configurable remote host are accepted.
 */
export function localHttp(path,{port=3001,timeoutMs=3000,maxBytes=1048576}={}) {
  if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//')||/[\x00-\x20\x7f]/.test(path)||path.length>2048)throw Error('Invalid local backend path');
  if(!Number.isInteger(port)||port<1||port>65535||!Number.isFinite(timeoutMs)||timeoutMs<=0||!Number.isSafeInteger(maxBytes)||maxBytes<1)throw Error('Invalid local request limits');
  return new Promise((resolve,reject)=>{
    let settled=false,timer;
    const fail=error=>{
      if(settled)return;settled=true;clearTimeout(timer);
      const code=typeof error.code==='string'?error.code:'HTTP_ERROR';
      reject(Object.assign(new Error(`Backend GET ${path} failed (${code})`),{code,cause:error}));
    };
    const request=get({hostname:'127.0.0.1',port,path,agent:false,headers:{Connection:'close'}},response=>{
      const chunks=[];let size=0;
      response.on('data',chunk=>{
        size+=chunk.length;
        if(size>maxBytes){const error=Object.assign(new Error('Backend response too large'),{code:'EMAXSIZE'});fail(error);response.destroy();request.destroy();return;}
        chunks.push(chunk);
      });
      response.on('aborted',()=>fail(Object.assign(new Error('Backend response aborted'),{code:'ECONNRESET'})));
      response.on('error',fail);
      response.on('end',()=>{
        if(settled)return;settled=true;clearTimeout(timer);
        resolve({status:response.statusCode,ok:response.statusCode>=200&&response.statusCode<300,body:Buffer.concat(chunks)});
      });
    });
    request.on('error',fail);
    timer=setTimeout(()=>{const error=Object.assign(new Error('Backend request timed out'),{code:'ETIMEDOUT'});fail(error);request.destroy();},timeoutMs);
  });
}
