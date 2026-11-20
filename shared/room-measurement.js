import {targetDefaults,targetSettings} from './room-targets.js';
/** Sweep analyser version. The analyser runs from the host helper (not the OTA slot), so results carry it and the GUI can tell when the Pi still runs an older copy. */
export const measurementAnalyserVersion='2026.11.20-sweep-diagnostics.2';
/** Plain-language reasons for a failed sweep check, as [locale key, values] pairs. */
export function sweepDiagnosis(channel){
 const d=channel?.diagnostics;if(!d||!Array.isArray(d.checks))return [['This result comes from older measurement software on the device. Run sudo bash /opt/daw-one/deploy/update-appliance.sh --apply once on the Pi, then measure again.',{}]];
 const out=[],check=id=>d.checks.find(c=>c.id===id);
 if(d.analyser!==measurementAnalyserVersion)out.push(['This result comes from older measurement software on the device. Run sudo bash /opt/daw-one/deploy/update-appliance.sh --apply once on the Pi, then measure again.',{}]);
 for(const id of d.failed||[]){const c=check(id);if(!c)continue;
  if(id==='complete')out.push(['The sweep arrived {lag} ms late and ran past the end of the recording.',{lag:c.value.lagMs}]);
  if(id==='edge')out.push(['The best match lies at the edge of the search window ({lag} ms). The speaker may not have played the sweep.',{lag:c.value.lagMs}]);
  if(id==='prominence')out.push(['The sweep stands out {value}× above the background; {need}× is needed. The microphone mostly heard noise or another sound.',{value:c.value,need:c.need}]);
  if(id==='level'){const m=(c.value.marginsDb||[]).slice(1).filter(v=>v!==null);out.push(['The middle and high part of the sweep is only {db} dB above the quietest part of the recording; 3 dB is needed. Check that the tweeter plays and the chosen output is connected.',{db:m.length?Math.min(...m):0}]);if(d.settling)out.push(['The microphone was still settling during the lead-in. Wait a moment after plugging it in, then measure again.',{}]);}
  if(id==='clipping')out.push(['Clipping {value}% (at most 0.1%). Lower the amplifier volume a little.',{value:c.value}]);
 }
 return out;
}
export const roomDefaults=()=>({length:5,width:4,height:2.5,speakerHeight:1,listeningDistance:2.5,speakerSpacing:2,wallDistance:.5,placement:'free-standing',microphoneType:'measurement',microphoneModel:'',genres:[],calibration:[],target:targetDefaults()});
export function measuredBaseline(result){return ['flat-eq','verified-output'].includes(result?.baseline)&&Array.isArray(result.channels)&&result.channels.length===2&&result.channels.every(c=>c.valid===true&&c.sweepDetected===true&&Number.isFinite(c.snrDb)&&c.snrDb>=15&&Number.isFinite(c.clipPercent)&&c.clipPercent<.1);}
export function measurementSetupKey({profile,output,microphone}){const {target,genres,...setup}=roomProfile(profile);return JSON.stringify([output,microphone,setup]);}
export function roomProfile(value){const defaults=roomDefaults();if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!Object.hasOwn(defaults,k)))throw Error('Invalid room profile');const p={...defaults,...value};for(const [k,min,max] of [['length',1,30],['width',1,30],['height',1.5,10],['speakerHeight',.1,4],['listeningDistance',.3,15],['speakerSpacing',.2,15],['wallDistance',0,10]])if(!Number.isFinite(p[k])||p[k]<min||p[k]>max)throw Error('Room or speaker dimensions are outside the supported range');if(!['free-standing','wall','corner','shelf'].includes(p.placement)||!['measurement','other-usb'].includes(p.microphoneType)||typeof p.microphoneModel!=='string'||p.microphoneModel.length>80||/[\x00-\x1f]/.test(p.microphoneModel)||!Array.isArray(p.genres)||p.genres.length>12||p.genres.some(g=>typeof g!=='string'||g.length>50||/[\x00-\x1f]/.test(g))||!Array.isArray(p.calibration)||p.calibration.length>128||p.calibration.some((v,i)=>!Array.isArray(v)||v.length!==2||!Number.isFinite(v[0])||v[0]<20||v[0]>24000||!Number.isFinite(v[1])||Math.abs(v[1])>30||i>0&&v[0]<=p.calibration[i-1][0]))throw Error('Invalid microphone or preference data');p.target=targetSettings(p.target);return p;}
