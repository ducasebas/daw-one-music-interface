import {tr} from "../shared/i18n.js";
import React,{useEffect,useRef,useState} from 'react';
import {useDeviceUpdates} from './DeviceUpdates.jsx';
import {displayDefaults,timeoutChoices} from '../shared/display-settings.js';
import {ScreenSettings} from './WallExperience.jsx';
import {useTemperatureDisplay} from './useTemperatureDisplay.js';
import {Icon} from './Icon.jsx';

export function SensorDashboard({snapshot,offline=false}) {
  const telemetry=snapshot.hardwareTelemetry;
  const temperature=useTemperatureDisplay(telemetry?.temperature,offline);
  const reading=(metric,digits,unit,value)=>!offline&&metric?.status==='ok'&&Number.isFinite(value??metric.value)?(value??metric.value).toFixed(digits)+' '+unit:'Unavailable';
  return <section className="sensor-dashboard" aria-label={tr("Sensors")}>
    <article><Icon name="temperature" size={34}/><span>{tr("Ambient temperature")}</span><strong>{tr(reading(telemetry?.temperature,1,'°C',temperature))}</strong><small>{tr("PCT2075 · I²C")}</small></article>
    <article><Icon name="sun" size={34}/><span>{tr("Ambient light")}</span><strong>{tr(reading(telemetry?.light,0,'lux'))}</strong><small>{tr("TSL2591 · I²C")}</small></article>
    <p role="status">{tr(offline?'Connection lost. Sensor readings are unavailable.':telemetry?.enabled?'Live sensor readings. Temperature changes are gently filtered.':'Sensor service is not connected. Run the sensor installer on the Pi.')}</p>
  </section>;
}

export function DisplaySettings({prefs,update,offline=false}) {
  const device=useDeviceUpdates();
  const [data,setData]=useState(null),[draft,setDraft]=useState(null),[notice,setNotice]=useState('');
  const timer=useRef(null),latest=useRef(null);
  useEffect(()=>{let live=true;fetch('/api/display').then(r=>{if(!r.ok)throw Error();return r.json();}).then(v=>{if(live){setData(v);setDraft(v.settings);latest.current=v.settings;}}).catch(()=>{if(live)setNotice('Display settings are unavailable while offline.');});return()=>{live=false;clearTimeout(timer.current);};},[]);
  async function save(value){
    try{
      const r=await fetch('/api/display',{method:'POST',headers:{'Content-Type':'application/json','X-TuneBox-Control':device?.info?.controlToken||''},body:JSON.stringify(value),signal:AbortSignal.timeout(5000)});
      if(!r.ok)throw Error();setNotice('Saved');
    }catch{setNotice('Could not save display settings. Check the connection.');}
  }
  const change=(key,value)=>{const next={...(latest.current||displayDefaults),[key]:value};latest.current=next;setDraft(next);setNotice('');clearTimeout(timer.current);timer.current=setTimeout(()=>save(next),350);};
  const value=draft||displayDefaults,disabled=offline||!draft||!device?.info?.controlToken;
  return <div className="display-settings">
    <div className="settings-fields">
      <label>{tr("Screen timeout")}<select aria-label={tr("Screen timeout")} disabled={disabled} value={value.timeoutSeconds} onChange={e=>change('timeoutSeconds',Number(e.target.value))}>{timeoutChoices.map(n=><option key={n} value={n}>{n===0?tr('Never'):n<60?n+' '+tr('seconds'):n/60+' '+tr(n===60?'minute':'minutes')}</option>)}</select></label>
      <label className="setting-switch"><span>{tr("Automatic brightness")}<small>{tr("Adjust the DSI backlight using the light sensor.")}</small></span><input aria-label={tr("Automatic brightness")} type="checkbox" role="switch" disabled={disabled||!data?.backlight?.supported} checked={value.brightnessMode==='auto'} onChange={e=>change('brightnessMode',e.target.checked?'auto':'manual')}/></label>
      <label>{tr("Brightness ")}<output>{tr(value.brightness)}%</output><input aria-label={tr("Manual brightness")} type="range" min="5" max="100" disabled={disabled} value={value.brightness} onChange={e=>change('brightness',Number(e.target.value))}/><small>{tr(value.brightnessMode==='auto'?'Used when a light reading is unavailable.':'Manual backlight level.')}</small></label>
      {value.brightnessMode==='auto'&&<><label>{tr("Minimum brightness ")}<output>{tr(value.minimum)}%</output><input aria-label={tr("Minimum brightness")} type="range" min="5" max={value.maximum} value={value.minimum} disabled={disabled} onChange={e=>change('minimum',Number(e.target.value))}/></label><label>{tr("Maximum brightness ")}<output>{tr(value.maximum)}%</output><input aria-label={tr("Maximum brightness")} type="range" min={value.minimum} max="100" value={value.maximum} disabled={disabled} onChange={e=>change('maximum',Number(e.target.value))}/></label></>}
    </div>
    {!data?.backlight?.supported&&<p className="settings-note">{tr("Physical brightness control requires the display service on the Pi.")}</p>}
    <ScreenSettings prefs={prefs} update={update}/>
    <p role="status" className="settings-note">{tr(notice)}</p>
  </div>;
}
