/** Import response deviation (Hz, dB), not sensitivity or an absolute SPL certificate. */
export function parseMicrophoneCalibration(text){
 if(typeof text!=='string'||text.length>262144)throw Error('Calibration file must be smaller than 256 kB');
 let rows;
 if(text.trim().startsWith('[')){
  try{rows=JSON.parse(text);}catch{throw Error('Invalid calibration JSON');}
 }else{
  rows=[];
  for(const line of text.replace(/^\uFEFF/,'').split(/\r?\n/)){
   const v=line.trim();if(!v||/^[#*;"']/.test(v)||/^(?:sens(?:itivity)?\s*factor|serial|frequency|freq\b|hz\b)/i.test(v))continue;
   const columns=v.split(/[\s,]+/);if(columns.length<2||columns.length>3||columns.some(c=>!c||!Number.isFinite(Number(c))))throw Error('Use a microphone response file with frequency and dB columns');
   rows.push([Number(columns[0]),Number(columns[1])]);
  }
 }
 if(!Array.isArray(rows)||rows.length>4096||rows.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<=0||Math.abs(p[1])>30))throw Error('Calibration points must contain frequency (Hz) and response deviation (±30 dB)');
 const points=rows.filter(p=>p[0]>=20&&p[0]<=24000).sort((a,b)=>a[0]-b[0]);
 if(points.length<2||points.some((p,i)=>i&&p[0]===points[i-1][0]))throw Error('Calibration requires at least two unique frequencies between 20 Hz and 24 kHz');
 // Preserve the largest response features in log-frequency space, within the stored 128-point bound.
 const keep=new Set([0,points.length-1]);
 while(keep.size<Math.min(128,points.length)){
  const indices=[...keep].sort((a,b)=>a-b);let error=0,index=-1;
  for(let j=1;j<indices.length;j++){
   const a=indices[j-1],b=indices[j];
   for(let i=a+1;i<b;i++){const expected=points[a][1]+(points[b][1]-points[a][1])*Math.log(points[i][0]/points[a][0])/Math.log(points[b][0]/points[a][0]),delta=Math.abs(expected-points[i][1]);if(delta>error){error=delta;index=i;}}
  }
  if(index<0||error<=.025)break;keep.add(index);
 }
 return [...keep].sort((a,b)=>a-b).map(i=>[...points[i]]);
}
