/**
 * Built-in places: a city name gives the official IANA time zone (daylight saving follows automatically) and
 * approximate coordinates for sunrise and sunset. Offline; nothing about the location leaves TuneBox.
 * Coordinates are city centres to two decimals, which is plenty for sun times (about ±1 minute).
 */
const raw=`Amsterdam|NL|Europe/Amsterdam|52.37|4.90
Rotterdam|NL|Europe/Amsterdam|51.92|4.48
Den Haag|NL|Europe/Amsterdam|52.08|4.31
Utrecht|NL|Europe/Amsterdam|52.09|5.12
Eindhoven|NL|Europe/Amsterdam|51.44|5.48
Groningen|NL|Europe/Amsterdam|53.22|6.57
Tilburg|NL|Europe/Amsterdam|51.56|5.09
Almere|NL|Europe/Amsterdam|52.37|5.21
Breda|NL|Europe/Amsterdam|51.59|4.78
Nijmegen|NL|Europe/Amsterdam|51.84|5.86
Arnhem|NL|Europe/Amsterdam|51.98|5.91
Zwolle|NL|Europe/Amsterdam|52.52|6.09
Maastricht|NL|Europe/Amsterdam|50.85|5.69
Leeuwarden|NL|Europe/Amsterdam|53.20|5.80
Middelburg|NL|Europe/Amsterdam|51.50|3.61
Enschede|NL|Europe/Amsterdam|52.22|6.89
Haarlem|NL|Europe/Amsterdam|52.38|4.64
Leiden|NL|Europe/Amsterdam|52.16|4.49
Delft|NL|Europe/Amsterdam|52.01|4.36
's-Hertogenbosch|NL|Europe/Amsterdam|51.69|5.30
Brussel|BE|Europe/Brussels|50.85|4.35
Antwerpen|BE|Europe/Brussels|51.22|4.40
Gent|BE|Europe/Brussels|51.05|3.72
Brugge|BE|Europe/Brussels|51.21|3.22
Leuven|BE|Europe/Brussels|50.88|4.70
Luik|BE|Europe/Brussels|50.63|5.57
Luxembourg|LU|Europe/Luxembourg|49.61|6.13
Oslo|NO|Europe/Oslo|59.91|10.75
Bergen|NO|Europe/Oslo|60.39|5.32
Stavanger|NO|Europe/Oslo|58.97|5.73
Trondheim|NO|Europe/Oslo|63.43|10.40
Kristiansand|NO|Europe/Oslo|58.15|8.00
Tromsø|NO|Europe/Oslo|69.65|18.96
Drammen|NO|Europe/Oslo|59.74|10.20
Haugesund|NO|Europe/Oslo|59.41|5.27
Ålesund|NO|Europe/Oslo|62.47|6.15
Stockholm|SE|Europe/Stockholm|59.33|18.07
Göteborg|SE|Europe/Stockholm|57.71|11.97
Malmö|SE|Europe/Stockholm|55.60|13.00
København|DK|Europe/Copenhagen|55.68|12.57
Aarhus|DK|Europe/Copenhagen|56.16|10.20
Helsinki|FI|Europe/Helsinki|60.17|24.94
Reykjavík|IS|Atlantic/Reykjavik|64.15|-21.94
Berlin|DE|Europe/Berlin|52.52|13.40
Hamburg|DE|Europe/Berlin|53.55|9.99
München|DE|Europe/Berlin|48.14|11.58
Köln|DE|Europe/Berlin|50.94|6.96
Düsseldorf|DE|Europe/Berlin|51.23|6.78
Frankfurt am Main|DE|Europe/Berlin|50.11|8.68
Stuttgart|DE|Europe/Berlin|48.78|9.18
Aachen|DE|Europe/Berlin|50.78|6.08
Wien|AT|Europe/Vienna|48.21|16.37
Zürich|CH|Europe/Zurich|47.38|8.54
Genève|CH|Europe/Zurich|46.20|6.15
Paris|FR|Europe/Paris|48.86|2.35
Lyon|FR|Europe/Paris|45.76|4.84
Marseille|FR|Europe/Paris|43.30|5.37
Nice|FR|Europe/Paris|43.70|7.27
Lille|FR|Europe/Paris|50.63|3.06
Bordeaux|FR|Europe/Paris|44.84|-0.58
London|GB|Europe/London|51.51|-0.13
Manchester|GB|Europe/London|53.48|-2.24
Edinburgh|GB|Europe/London|55.95|-3.19
Glasgow|GB|Europe/London|55.86|-4.25
Bristol|GB|Europe/London|51.45|-2.59
Dublin|IE|Europe/Dublin|53.35|-6.26
Madrid|ES|Europe/Madrid|40.42|-3.70
Barcelona|ES|Europe/Madrid|41.39|2.17
Valencia|ES|Europe/Madrid|39.47|-0.38
Sevilla|ES|Europe/Madrid|37.39|-5.98
Málaga|ES|Europe/Madrid|36.72|-4.42
Palma|ES|Europe/Madrid|39.57|2.65
Las Palmas|ES|Atlantic/Canary|28.12|-15.44
Lisboa|PT|Europe/Lisbon|38.72|-9.14
Porto|PT|Europe/Lisbon|41.15|-8.61
Roma|IT|Europe/Rome|41.90|12.50
Milano|IT|Europe/Rome|45.46|9.19
Firenze|IT|Europe/Rome|43.77|11.26
Napoli|IT|Europe/Rome|40.85|14.27
Athína|GR|Europe/Athens|37.98|23.73
Praha|CZ|Europe/Prague|50.08|14.44
Warszawa|PL|Europe/Warsaw|52.23|21.01
Kraków|PL|Europe/Warsaw|50.06|19.94
Budapest|HU|Europe/Budapest|47.50|19.04
İstanbul|TR|Europe/Istanbul|41.01|28.98
New York|US|America/New_York|40.71|-74.01
Boston|US|America/New_York|42.36|-71.06
Chicago|US|America/Chicago|41.88|-87.63
Denver|US|America/Denver|39.74|-104.99
Los Angeles|US|America/Los_Angeles|34.05|-118.24
San Francisco|US|America/Los_Angeles|37.77|-122.42
Seattle|US|America/Los_Angeles|47.61|-122.33
Toronto|CA|America/Toronto|43.65|-79.38
Vancouver|CA|America/Vancouver|49.28|-123.12
México|MX|America/Mexico_City|19.43|-99.13
São Paulo|BR|America/Sao_Paulo|-23.55|-46.63
Paramaribo|SR|America/Paramaribo|5.85|-55.20
Willemstad|CW|America/Curacao|12.11|-68.93
Kaapstad|ZA|Africa/Johannesburg|-33.92|18.42
Dubai|AE|Asia/Dubai|25.20|55.27
Tokyo|JP|Asia/Tokyo|35.68|139.69
Singapore|SG|Asia/Singapore|1.35|103.82
Jakarta|ID|Asia/Jakarta|-6.21|106.85
Sydney|AU|Australia/Sydney|-33.87|151.21
Melbourne|AU|Australia/Melbourne|-37.81|144.96
Auckland|NZ|Pacific/Auckland|-36.85|174.76`;
export const places=Object.freeze(raw.split('\n').map(line=>{const [name,country,timeZone,lat,lon]=line.split('|');return Object.freeze({name,country,timeZone,latitude:Number(lat),longitude:Number(lon)});}));
const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ø/g,'o').replace(/æ/g,'ae').replace(/ß/g,'ss').replace(/ı/g,'i').toLowerCase().trim();
/** Places whose name starts with the query first, then names containing it; diacritics and case ignored. */
export function searchPlaces(query,limit=6){
 const q=fold(query);if(q.length<2)return [];
 const starts=[],contains=[],zones=[];
 for(const p of places){const n=fold(p.name);if(n.startsWith(q))starts.push(p);else if(n.includes(q))contains.push(p);else if(fold(p.timeZone).includes(q))zones.push(p);}
 // Time-zone names only help when typed as such ("europe/") or when no city name matches.
 return [...starts,...contains,...(q.includes('/')||!starts.length&&!contains.length?zones:[])].slice(0,limit);
}
/** A sensible default place for a time zone (the first listed city in it), or null. */
export function placeForTimeZone(timeZone){return places.find(p=>p.timeZone===timeZone)||null;}
export function placeByName(name){return places.find(p=>p.name===name)||null;}
/** The local UTC offset label for a place right now, e.g. "UTC+1" or "UTC+2" in summer. */
export function utcOffsetLabel(timeZone,date=new Date()){
 try{const part=new Intl.DateTimeFormat('en',{timeZone,timeZoneName:'shortOffset'}).formatToParts(date).find(p=>p.type==='timeZoneName')?.value||'';return part.replace('GMT','UTC')||'UTC';}catch{return '';}
}
