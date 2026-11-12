import {repository,verifyManifest} from './policy.mjs';

/** GitHub's presentation order is not a release version. Rank signed sequences. */
export async function selectRelease(releases,{channel,key,download}) {
 if(!Array.isArray(releases)||releases.length>100||!['preview','stable'].includes(channel))throw Error('Invalid channel release inventory');
 const tagPattern=new RegExp('^ota-'+channel+'-[a-f0-9]{40}$');
 const candidates=releases.filter(r=>r&&r.draft===false&&typeof r.tag_name==='string'&&tagPattern.test(r.tag_name));
 if(!candidates.length)return null;
 const verified=[],failures=[];
 for(const candidate of candidates){
  try{
   const url='https://github.com/'+repository+'/releases/download/'+candidate.tag_name+'/';
   const [raw,signature]=await Promise.all([download(url+'ota-manifest.json',8192),download(url+'ota-manifest.sig',256)]);
   const manifest=verifyManifest(raw,Buffer.from(signature.toString().trim(),'base64'),key,channel,0);
   if(candidate.tag_name!=='ota-'+channel+'-'+manifest.commit)throw Error('Tag mismatch');
   verified.push({url,manifest});
  }catch{failures.push(candidate.tag_name);}
 }
 if(!verified.length)throw Error('No channel release could be verified');
 verified.sort((a,b)=>b.manifest.sequence-a.manifest.sequence);
 if(verified.some(v=>v.manifest.sequence===verified[0].manifest.sequence&&v.manifest.commit!==verified[0].manifest.commit))throw Error('Conflicting signed release sequence');
 return {...verified[0],failures};
}

/** An incomplete check must never be presented as proof that the Pi is current. */
export function releaseIsCurrent(selection,current={}) {
 const manifest=selection.manifest;
 const result=manifest.sequence<(current.sequence||0)||manifest.sequence===current.sequence&&manifest.commit===current.commit;
 if(result&&selection.failures.length)throw Error('Release check incomplete; some channel releases could not be verified');
 return result;
}
