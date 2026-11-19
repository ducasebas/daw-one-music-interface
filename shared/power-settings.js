/** Reader settings and separate legacy-100W / verified-20V startup policies. */
export const startupPowerKeys=Object.freeze(['startup100W','startup20V','startupMaximum20V']);
export const powerDefaults=Object.freeze({ina228:false,husb238:false,currentPathVerified:false,voltageSenseVerified:false,startup100W:false,startup20V:false,startupMaximum20V:false});
export function powerSettings(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!Object.hasOwn(powerDefaults,k)))throw Error('Invalid power monitoring settings');
 const settings={...powerDefaults,...input};
 if(Object.values(settings).some(v=>typeof v!=='boolean'))throw Error('Invalid power monitoring settings');
 if(settings.startup100W&&!settings.husb238)throw Error('Keep HUSB238 monitoring enabled for automatic 100 W setup');
 if((settings.startup20V||settings.startupMaximum20V)&&!settings.husb238)throw Error('Keep HUSB238 monitoring enabled for automatic power setup');
 if(startupPowerKeys.filter(k=>settings[k]).length>1)throw Error('Choose one automatic power setup policy');
 return settings;
}
