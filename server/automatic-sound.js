/** Event-driven bridge. No polling or command on every playback clock update. */
export class AutomaticSound {
  constructor({context,perform,onChange=()=>{},delay=600,retryDelay=1500}={}){Object.assign(this,{context,perform,onChange,delay,retryDelay});this.key=null;this.timer=null;this.closed=false;this.busy=false;}
  schedule(){
    if(this.closed)return;const c=this.context();
    if(!c.enabled||!c.bluetooth&&(!c.connected||!c.localSelected||!c.playing)){clearTimeout(this.timer);this.key=null;return;}
    const key=JSON.stringify([c.bluetooth?'bluetooth':'local',c.bluetooth?null:c.trackKey,c.settings]);if(key===this.key)return;
    this.key=key;clearTimeout(this.timer);this.timer=setTimeout(()=>this.run(key,0),this.delay);this.timer.unref?.();
  }
  async run(key,attempt){
    if(this.closed||this.key!==key)return;
    if(this.busy){this.timer=setTimeout(()=>this.run(key,attempt),this.retryDelay);return;}
    const c=this.context();if(!c.enabled||!c.bluetooth&&(!c.connected||!c.localSelected||!c.playing))return;
    this.busy=true;
    try{await this.perform();this.onChange();}
    catch{if(!this.closed&&this.key===key&&attempt<1){this.timer=setTimeout(()=>this.run(key,attempt+1),this.retryDelay);this.timer.unref?.();}}
    finally{this.busy=false;}
  }
  close(){this.closed=true;clearTimeout(this.timer);}
}
