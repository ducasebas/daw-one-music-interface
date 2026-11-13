import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {selectRelease} from './releases.mjs';
import {repository} from './policy.mjs';
import {release} from '../../shared/release.js';

/** Check the public inventory through the same selector used by installed devices. */
export async function checkChannel({expectedCommit,key,download,channel='preview'}) {
 if(!/^[a-f0-9]{40}$/.test(expectedCommit))throw Error('Expected release commit required');
 const inventory=JSON.parse((await download('https://api.github.com/repos/'+repository+'/releases?per_page=30',1048576)).toString());
 const selected=await selectRelease(inventory,{channel,key,download});
 if(!selected||selected.failures.length||selected.manifest.commit!==expectedCommit||selected.manifest.release!==release.id)throw Error('Public channel does not select the expected verified release');
 return {commit:selected.manifest.commit,release:selected.manifest.release,sequence:selected.manifest.sequence};
}
async function download(url,maxBytes){
 const response=await fetch(url,{headers:{'User-Agent':'TuneBox-channel-check'},signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error('Public channel HTTP '+response.status);
 const chunks=[];let bytes=0;
 for await(const chunk of response.body){bytes+=chunk.length;if(bytes>maxBytes)throw Error('Public channel response too large');chunks.push(chunk);}
 return Buffer.concat(chunks);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const key=readFileSync(new URL('./public.pem',import.meta.url));
 let failure;
 // Release-list caches may briefly lag behind publication of the assets.
 for(let attempt=0;attempt<6;attempt++){
  try{console.log(JSON.stringify({component:'tunebox-channel-check',...await checkChannel({expectedCommit:process.argv[2],key,download})}));failure=null;break;}
  catch(error){failure=error;if(attempt<5)await new Promise(resolve=>setTimeout(resolve,10000));}
 }
 if(failure)throw failure;
}
