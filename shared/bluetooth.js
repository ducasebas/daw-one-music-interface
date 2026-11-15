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
