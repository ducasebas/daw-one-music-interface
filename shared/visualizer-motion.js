/** Redistribute a visual scale without changing the measurement or its labelled endpoints. */
export function visualFraction(fraction,sensitivity=0){
 const f=Math.max(0,Math.min(1,Number.isFinite(fraction)?fraction:0));
 const s=Math.max(-12,Math.min(12,Number.isFinite(sensitivity)?sensitivity:0));
 return Math.pow(f,Math.pow(2,-s/12));
}
export function visualResponse(mode='natural'){
 return mode==='quick'?{attack:30,release:130}:mode==='relaxed'?{attack:90,release:400}:{attack:45,release:220};
}
