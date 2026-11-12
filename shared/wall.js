/** Wall display presentation contracts. Never grant actuator permissions. */
export const sleepModes = ['clock','widgets','sunset','glow','playing','black','vu','spectrum','bars'];
export function screenSettings(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  const extended=value.extended===true;
  return {
    mode: sleepModes.includes(value.mode) ? value.mode : 'clock',
    latitude: Number.isFinite(value.latitude) && Math.abs(value.latitude)<=90 ? value.latitude : null,
    longitude: Number.isFinite(value.longitude) && Math.abs(value.longitude)<=180 ? value.longitude : null,
    ...(extended?{extended:true,showDate:value.showDate!==false,showHint:value.showHint!==false,leftColor:/^#[a-f0-9]{6}$/i.test(value.leftColor||'')?value.leftColor:'#c8a56c',rightColor:/^#[a-f0-9]{6}$/i.test(value.rightColor||'')?value.rightColor:'#c8a56c',meterReference:[-24,-20,-18,-16,-14].includes(value.meterReference)?value.meterReference:-18}:{}),
  };
}
export function wifiReading(network, offline=false) {
  if(offline) return {label:'Offline',level:null,simulated:false};
  const signal=network?.signal;
  const valid=network?.connected===true && Number.isFinite(signal) && signal>=0 && signal<=100;
  return {label:valid?`${Math.round(signal)}%`:network?.connected===false?'Wifi niet verbonden':'Signaal onbekend',
    level:valid?Math.round(signal):null,simulated:network?.simulated===true};
}
/** NOAA sunrise/sunset approximation; sunset for the location's local calendar date.
 * No location permission, network lookup or invented default location. Polar cases return null.
 */
export function sunsetAt(date,latitude,longitude) {
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return null;
  const rad=Math.PI/180, day=Math.floor((Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())-Date.UTC(date.getFullYear(),0,0))/86400000);
  const t=day+(18-longitude/15)/24, m=.9856*t-3.289;
  const wrap=x=>(x%360+360)%360;
  const l=wrap(m+1.916*Math.sin(m*rad)+.020*Math.sin(2*m*rad)+282.634);
  let ra=wrap(Math.atan(.91764*Math.tan(l*rad))/rad);
  ra+=(Math.floor(l/90)*90-Math.floor(ra/90)*90);ra/=15;
  const sinDec=.39782*Math.sin(l*rad),cosDec=Math.cos(Math.asin(sinDec));
  const cosH=(Math.cos(90.833*rad)-sinDec*Math.sin(latitude*rad))/(cosDec*Math.cos(latitude*rad));
  if(!Number.isFinite(cosH)||cosH>1||cosH< -1)return null;
  const utc=Math.acos(cosH)/rad/15+ra-.06571*t-6.622-longitude/15;
  // Select the UTC day which makes the event fall near 18:00 local solar time.
  let hours=(utc%24+24)%24;
  hours+=24*Math.round(((18-longitude/15)-hours)/24);
  return new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())+hours*3600000);
}
export function wallNotifications(snapshot,updates,offline=false) {
  const simulated=snapshot.mode==='simulation';
  const power=snapshot.boot?.checks?.find(c=>c.id==='power');
  const faults=snapshot.device?.faults||[];
  return [
    {id:'status',icon:'status',title:'Systeemrapport',detail:offline?'Backend offline · status niet actueel':`${snapshot.device?.mode||'onbekend'} · ${snapshot.musicAssistant?.connected?'Music Assistant verbonden':simulated?'gesimuleerde muziek':'Music Assistant niet verbonden'}`,action:'status'},
    {id:'update',icon:'update',title:'Update',detail:updates?.offline?'Updateservice niet bereikbaar':updates?.status||'Nog geen updatestatus',action:'updates'},
    {id:'hardware',icon:'alert',title:'Hardware alert',detail:faults.length?faults.join(', '):power?.reason||'PD-contract onbekend · 100 W niet bevestigd',attention:faults.length>0||power?.status!=='pass',simulated,action:'status'},
    {id:'newsletter',icon:'mail',title:'Newsletter',detail:'Geen nieuwsbrief gekoppeld. Er wordt niets automatisch opgehaald of verstuurd.'},
    {id:'whatsnew',icon:'discover',title:'What’s new',detail:'GUI 3.2 · Save/Cancel · Wi-Fi setup · PIN · sensors · debug · room measurement and listening targets.'},
    {id:'tutorial',icon:'tutorial',title:'Tutorial',detail:'Tik op de hoes voor Nu spelen. Veeg instellingenpagina’s. Schermrust stopt de muziek niet; de eerste aanraking wekt alleen het scherm.'},
  ];
}
