export const bluetoothCommands=['bluetooth-start','bluetooth-stop','bluetooth-pair','bluetooth-close-pairing','bluetooth-confirm','bluetooth-forget','bluetooth-disconnect','bluetooth-volume'];
export function bluetoothRequest(command,args){
 const allowed={'bluetooth-start':['confirmed'],'bluetooth-stop':[],'bluetooth-pair':[],'bluetooth-close-pairing':[],'bluetooth-confirm':['nonce','accept'],'bluetooth-forget':['address','confirmed'],'bluetooth-disconnect':['address'],'bluetooth-volume':['value','sessionId']}[command];
 if(!allowed||Object.keys(args).some(k=>!allowed.includes(k)))throw Error('Invalid Bluetooth action');
 if(command==='bluetooth-start'&&args.confirmed!==true)throw Error('Confirm switching this local audio source');
 if(command==='bluetooth-confirm'&&(!/^[a-f0-9]{32}$/.test(args.nonce)||typeof args.accept!=='boolean'))throw Error('Pairing request expired; open it again');
 if(['bluetooth-forget','bluetooth-disconnect'].includes(command)&&!/^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(args.address))throw Error('Choose a detected Bluetooth device');
 if(command==='bluetooth-forget'&&args.confirmed!==true)throw Error('Confirm forgetting this device');
 if(command==='bluetooth-volume'&&(!Number.isInteger(args.value)||args.value<0||args.value>100||typeof args.sessionId!=='string'||!/^[-a-f0-9]{36}$/.test(args.sessionId)))throw Error('Invalid local Bluetooth volume or expired source');
 return args;
}
export function bluetoothGainChanges(controls,saved,value,limit){
 if(!Number.isInteger(value)||value<0||!Number.isInteger(limit)||limit<0||limit>100||value>limit)throw Error('Bluetooth volume exceeds the saved limit');
 const gains=controls.filter(c=>/^Channel (Left|Right) Gain$/.test(c.name));
 if(gains.length!==2||gains.some(c=>c.type!=='INTEGER'||c.min!==-110||c.max!==0))throw Error('Verified Louder gain controls are required');
 return gains.map(c=>{const previous=saved.find(v=>v.id===c.id&&v.name===c.name);if(!previous||!Number.isInteger(previous.value)||previous.value>0||previous.value<c.min)throw Error('Invalid Bluetooth gain restoration');return {id:c.id,value:value===0?c.min:Math.max(c.min,Math.min(previous.value,previous.value+Math.floor((value-100)*.6)))};});
}

/** Honest A2DP link quality from the codec configuration BlueZ reports for the phone. Returns null when unknown.
 * SBC: bitrate from the negotiated maximum bitpool (A2DP spec frame length). AAC: the bitrate the phone states. */
export function bluetoothLinkQuality(transport){
 if(!transport||!Number.isInteger(transport.codec)||!Array.isArray(transport.configuration))return null;
 const c=transport.configuration;
 if(transport.codec===0&&c.length>=4){
  const rate=[[0x80,16000],[0x40,32000],[0x20,44100],[0x10,48000]].find(([bit])=>c[0]&bit)?.[1]||null;
  const mode=c[0]&0x0f,blocks=[[0x80,4],[0x40,8],[0x20,12],[0x10,16]].find(([bit])=>c[1]&bit)?.[1]||16,subbands=c[1]&0x08?4:8,bitpool=c[3],channels=mode&0x08?1:2;
  if(!rate||!(bitpool>=2&&bitpool<=250))return {codec:'SBC',kbps:null,sampleRate:rate,lossy:true};
  const joint=mode&0x01,stereo=mode&0x02;
  const frame=4+Math.ceil(4*subbands*channels/8)+(channels===1||!(joint||stereo)?Math.ceil(blocks*channels*bitpool/8):Math.ceil(((joint?subbands:0)+blocks*bitpool)/8));
  return {codec:'SBC',kbps:Math.round(8*frame*rate/(subbands*blocks)/1000),sampleRate:rate,lossy:true,bitpool};
 }
 if(transport.codec===2&&c.length>=6){
  const rate=c[1]&0x80?8000:c[1]&0x01?44100:(c[2]&0x80)?48000:null,bps=((c[3]&0x7f)<<16)|(c[4]<<8)|c[5];
  return {codec:'AAC',kbps:bps>0?Math.round(bps/1000):null,sampleRate:rate,lossy:true};
 }
 if(transport.codec===255&&c.length>=6){
  const vendor=c[0]|(c[1]<<8)|(c[2]<<16)|(c[3]<<24),id=c[4]|(c[5]<<8);
  const known={'79:1':['aptX',352],'215:36':['aptX HD',576],'301:170':['LDAC',null]}[`${vendor}:${id}`];
  return known?{codec:known[0],kbps:known[1],sampleRate:null,lossy:true}:{codec:'Vendor codec',kbps:null,sampleRate:null,lossy:true};
 }
 return {codec:transport.codec===1?'MP3':'Unknown',kbps:null,sampleRate:null,lossy:true};
}
/** Plain stability verdict from how long the link held and how often it dropped in the last hour. */
export function bluetoothStability(link){
 if(!link||!Number.isFinite(link.dropsLastHour))return 'unknown';
 if(link.dropsLastHour>=3)return 'unstable';
 if(link.dropsLastHour>=1)return 'drops';
 return link.connectedSeconds>=60?'stable':'new';
}
