import {targetSettings} from './room-targets.js';
import {roomProfile} from './room-measurement.js';
import { updateSettings } from './update-settings.js';
const commands=['status','measurement-status','measurement-start','measurement-stop','measurement-apply','measurement-undo','local-ma-status','local-ma-install','policy','check','install','rollback','network','wifi','wifi-scan','hotspot-start','hotspot-stop','clock','clock-set','dsp','dsp-set','erase-setup','local-standby','probe-music','save-music','audio-test','complete-setup','power-off'];
export function validateRequest(value) {
  if (!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(k=>!['command','args'].includes(k)) || !commands.includes(value.command)) throw Error('Unsupported device action');
  const args=value.args??{};
  if (!args || typeof args!=='object' || Array.isArray(args)) throw Error('Invalid device arguments');
  const allowed={'measurement-apply':['target','confirmed'],'measurement-undo':['confirmed'],'measurement-start':['microphone','profile','confirmed'],'local-ma-install':['confirmed'],policy:['mode','windowEnabled','start','end','timeZone'],wifi:['interface','ssid','password'],'wifi-scan':['interface'],'hotspot-start':['interface','confirmed'],'clock-set':['timeZone','automatic','iso'],'local-standby':['enabled'],'dsp-set':['controls'],'erase-setup':['confirmed'],'probe-music':['url','token'],'save-music':['url','token','playerId','allowControl'],'audio-test':['device'],'power-off':['confirmed']}[value.command]||[];
  if(Object.keys(args).some(k=>!allowed.includes(k))) throw Error('Unexpected device argument');
  if(value.command==='measurement-apply'){if(args.confirmed!==true)throw Error('Confirm applying the listening target');args.target=targetSettings(args.target);}
  if(value.command==='measurement-undo'&&args.confirmed!==true)throw Error('Confirm restoring the previous DSP values');
  if(value.command==='measurement-start'){if(args.confirmed!==true||typeof args.microphone!=='string'||!/^hw:[0-9]{1,2},[0-9]{1,2}$/.test(args.microphone))throw Error('Confirm an audible test and select a USB microphone');args.profile=roomProfile(args.profile);}
  if(value.command==='local-ma-install'&&args.confirmed!==true)throw Error('Confirm installing an additional local Music Assistant server');
  if(value.command==='power-off'&&args.confirmed!==true)throw Error('Confirm power off on this device');
  if(value.command==='local-standby'&&typeof args.enabled!=='boolean')throw Error('Choose standby on or off');
  if(value.command==='erase-setup'&&args.confirmed!=='ERASE TUNEBOX')throw Error('Confirm erasing this TuneBox setup');
  if(['wifi-scan','hotspot-start'].includes(value.command)&&args.interface!==undefined&&(typeof args.interface!=='string'||!/^wl[a-zA-Z0-9_-]{0,20}$/.test(args.interface)))throw Error('Choose a Wi-Fi interface');
  if(value.command==='hotspot-start'&&args.confirmed!==true)throw Error('Confirm switching Wi-Fi to setup hotspot');
  if(value.command==='clock-set'){try{if(typeof args.timeZone!=='string'||!/^[-a-zA-Z0-9_+/]{1,80}$/.test(args.timeZone)||args.timeZone.includes('..')||typeof args.automatic!=='boolean')throw Error();new Intl.DateTimeFormat('en',{timeZone:args.timeZone}).format();if(args.iso!==undefined&&(typeof args.iso!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(args.iso)||!Number.isFinite(Date.parse(args.iso))))throw Error();}catch{throw Error('Invalid date or time zone');}}
  if(value.command==='dsp-set'&&(!Array.isArray(args.controls)||args.controls.length<1||args.controls.length>20||args.controls.some(c=>!c||Object.keys(c).some(k=>!['id','value'].includes(k))||!Number.isInteger(c.id)||c.id<1||c.id>200||!Number.isInteger(c.value)||c.value< -150||c.value>255)))throw Error('Invalid DSP controls');
  if(value.command==='policy')return {command:value.command,args:updateSettings(args)};
  if(['probe-music','save-music'].includes(value.command)) {
    const url=new URL(args.url);const host=url.hostname.replace(/^\[|\]$/g,'');
    const local=/^(localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|::1|f[cd][a-f0-9:]+)$/i.test(host)||/^[a-z0-9.-]+\.(local|lan|home\.arpa)$/i.test(host);
    if(!local || !['http:','https:','ws:','wss:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/'&&url.pathname!=='/ws'||url.href.length>256)throw Error('Use a local Music Assistant base address');
    if(args.token!==undefined && (typeof args.token!=='string'||args.token.length>4096||/[\r\n\0]/.test(args.token)))throw Error('Invalid token');
    if(value.command==='save-music'&&(typeof args.playerId!=='string'||!args.playerId||args.playerId.length>200||/[\s"'\\\0]/.test(args.playerId)||typeof args.allowControl!=='boolean'))throw Error('Choose an available player');
  }
  if(value.command==='wifi' && (typeof args.interface!=='string'||!/^wl[a-zA-Z0-9_-]{0,20}$/.test(args.interface)||typeof args.ssid!=='string'||Buffer.byteLength(args.ssid)>32||!args.ssid||/^[\s-]|[\r\n\0]/.test(args.ssid)||typeof args.password!=='string'||args.password.length<8||args.password.length>63||/[^\x20-\x7e]/.test(args.password)))throw Error('Use a Wi-Fi interface, SSID and WPA password (8–63 characters)');
  if(value.command==='audio-test' && args.device!=='plughw:CARD=Headphones,DEV=0')throw Error('Only the Pi headphone test output is supported; HAT outputs remain blocked');
  return {command:value.command,args};
}
export class DeviceManager {
  constructor(adapter){this.adapter=adapter;this.busy=false;}
  async request(value){
    const {command,args}=validateRequest(value);
    if(command==='status')return this.adapter.status();
    if(this.busy)throw Error('Device action already running');
    this.busy=true;
    try{return await this.adapter.perform(command,args);}finally{this.busy=false;}
  }
}
