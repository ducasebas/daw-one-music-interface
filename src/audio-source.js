/** Keep fast analysis frames outside Settings and the music shell's React state. */
export function createAudioSource(){
 let current=null,metadata=null,key='';const listeners=new Set();
 return {
  get:()=>current,
  get metadata(){return metadata;},
  publish(value){
   current=value;const {measurement,...next}=value,nextKey=JSON.stringify(next),changed=nextKey!==key;
   if(changed){key=nextKey;metadata=next;}
   for(const listener of listeners)listener(value);
   return changed;
  },
  subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
 };
}
