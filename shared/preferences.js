import {settings} from './settings.js';
import {displaySettings,displayDefaults} from './display-settings.js';
import {normalizeThemePreferences} from './themes.js';

export const dashboardMetrics=['cpu','cpu-temperature','case-temperature','fan','lux','brightness','wifi','memory','power','volume'];
export const preferenceDefaults=()=>({prefs:settings(),display:{...displayDefaults},themePreferences:normalizeThemePreferences(),language:'en',audioEnabled:false,clock:{timeZone:'Europe/Amsterdam',hour12:false,automatic:true},presence:{enabled:false,maximumDistance:3,sensitivity:'medium',absenceSeconds:120,nightEnabled:false,nightStart:'22:00',nightEnd:'07:00'},dashboard:{visible:[],requiredWatts:100},maxVolume:100,buttonAction:'screen-rest',setupCompleted:false});
export function validatePreferences(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid preferences');
 const defaults=preferenceDefaults();if(Object.keys(value).some(k=>!Object.hasOwn(defaults,k)))throw Error('Unknown preference');
 const s={...defaults,...value};
 if(!['en','nl'].includes(s.language)||!['screen-rest','local-standby'].includes(s.buttonAction)||typeof s.audioEnabled!=='boolean'||typeof s.setupCompleted!=='boolean'||!Number.isInteger(s.maxVolume)||s.maxVolume<1||s.maxVolume>100)throw Error('Invalid language or volume limit');
 if(!s.clock||Object.keys(s.clock).some(k=>!['timeZone','hour12','automatic'].includes(k))||typeof s.clock.timeZone!=='string'||s.clock.timeZone.length>80||typeof s.clock.hour12!=='boolean'||typeof s.clock.automatic!=='boolean')throw Error('Invalid clock settings');
 try{new Intl.DateTimeFormat('en',{timeZone:s.clock.timeZone}).format();}catch{throw Error('Unknown time zone');}
 const p=s.presence;
 if(!p||Object.keys(p).some(k=>!Object.hasOwn(defaults.presence,k))||typeof p.enabled!=='boolean'||!Number.isFinite(p.maximumDistance)||p.maximumDistance<.5||p.maximumDistance>6||!['low','medium','high'].includes(p.sensitivity)||!Number.isInteger(p.absenceSeconds)||p.absenceSeconds<10||p.absenceSeconds>3600||typeof p.nightEnabled!=='boolean'||![p.nightStart,p.nightEnd].every(t=>typeof t==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))throw Error('Invalid presence settings');
 const d=s.dashboard;if(!d||Object.keys(d).some(k=>!['visible','requiredWatts'].includes(k))||!Array.isArray(d.visible)||d.visible.length>4||new Set(d.visible).size!==d.visible.length||d.visible.some(k=>!dashboardMetrics.includes(k))||!Number.isInteger(d.requiredWatts)||d.requiredWatts<15||d.requiredWatts>240)throw Error('Select up to four dashboard readings and a power requirement of 15–240 W');
 return {prefs:settings(s.prefs),display:displaySettings(s.display),themePreferences:normalizeThemePreferences(s.themePreferences),language:s.language,audioEnabled:s.audioEnabled,clock:{...s.clock},presence:{...p},dashboard:{...d,visible:[...d.visible]},maxVolume:s.maxVolume,buttonAction:s.buttonAction,setupCompleted:s.setupCompleted};
}
