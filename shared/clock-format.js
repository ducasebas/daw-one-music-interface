// Reuse bounded Intl formatters: a live snapshot must not construct them on each render.
const formats=new Map();
export function clockText(now,{timeZone,hour12=false}={}){
 const key=String(timeZone||'')+'|'+String(hour12===true);let format=formats.get(key);
 if(!format){
  const zone=timeZone?{timeZone}:{};
  format={time:new Intl.DateTimeFormat('en-GB',{...zone,hour:'2-digit',minute:'2-digit',hour12:hour12===true}),date:new Intl.DateTimeFormat('en-CA',{...zone,year:'numeric',month:'2-digit',day:'2-digit'})};
  formats.set(key,format);if(formats.size>8)formats.delete(formats.keys().next().value);
 }
 const parts=Object.fromEntries(format.date.formatToParts(now).filter(p=>['year','month','day'].includes(p.type)).map(p=>[p.type,p.value]));
 return {time:format.time.format(now).toUpperCase(),date:`${parts.year}-${parts.month}-${parts.day}`};
}
