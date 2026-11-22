import React,{useMemo,useState} from 'react';
import {KeyboardField} from './TouchKeyboard.jsx';
import {searchPlaces,utcOffsetLabel} from '../shared/places.js';
import {sunsetAt} from '../shared/wall.js';
import {tr,translateFormat} from '../shared/i18n.js';
/** Choose a city: it sets the time zone (daylight saving automatic) and the coordinates for sunrise and sunset. */
export function PlacePicker({place,timeZone,onChoose}){
 const [query,setQuery]=useState('');
 const suggestions=useMemo(()=>searchPlaces(query,6).map(p=>({id:p.name,name:p.name,artist:`${p.country} · ${p.timeZone.replace(/_/g,' ')} · ${utcOffsetLabel(p.timeZone)}`,type:'',available:true,place:p})),[query]);
 const now=new Date(),sunset=place?sunsetAt(now,place.latitude,place.longitude):null;
 const time=d=>d?d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',timeZone:place?.timeZone||timeZone}):'–';
 return <div className="place-picker">
  {place?<p className="place-current"><strong>{place.name}</strong><span>{place.timeZone.replace(/_/g,' ')} · {translateFormat('now {offset}, daylight saving automatic',{offset:utcOffsetLabel(place.timeZone)})}{sunset?<> · {translateFormat('sunset {time}',{time:time(sunset)})}</>:null}</span></p>
   :<p className="place-current"><span>{timeZone?translateFormat('Time zone {zone} · choose your city for sunrise and sunset',{zone:timeZone.replace(/_/g,' ')}):tr('Choose your city')}</span></p>}
  <KeyboardField label="Search your city" value={query} onChange={setQuery} suggestions={query.trim().length>=2?suggestions:undefined} suggestionsMinimum={2} onSuggestion={item=>{setQuery('');onChoose(item.place);}} placeholder={tr('e.g. Amsterdam')}/>
  <p className="place-note">{tr('Used for local time, daylight saving and sunrise/sunset. It stays on TuneBox.')}</p>
 </div>;
}
