import { updateSettings } from './update-settings.js';
const commands=['status','policy','check','install','rollback','network','wifi','probe-music','save-music','audio-test','complete-setup','power-off'];
export function validateRequest(value) {
  if (!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(k=>!['command','args'].includes(k)) || !commands.includes(value.command)) throw Error('Unsupported device action');
  const args=value.args??{};
  if (!args || typeof args!=='object' || Array.isArray(args)) throw Error('Invalid device arguments');
  const allowed={policy:['mode','windowEnabled','start','end','timeZone'],wifi:['interface','ssid','password'],'probe-music':['url','token'],'save-music':['url','token','playerId','allowControl'],'audio-test':['device'],'power-off':['confirmed']}[value.command]||[];
  if(Object.keys(args).some(k=>!allowed.includes(k))) throw Error('Unexpected device argument');
  if(value.command==='power-off'&&args.confirmed!==true)throw Error('Confirm power off on this device');
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
