import React,{useLayoutEffect,useRef} from 'react';
/** Fit once per text/size change. Only the overflow transform animates, never the shell. */
export function TrackText({as:Tag='p',text='',kind='title'}){
 const root=useRef(null),line=useRef(null);
 useLayoutEffect(()=>{
  const box=root.current,node=line.current;if(!box||!node)return;
  const measure=()=>{
   const compact=box.closest('.music2')?.dataset.panel!=='wall-16-10'||innerHeight<600;
   const maximum=compact?(kind==='title'?30:kind==='artist'?22:18):(kind==='title'?46:kind==='artist'?30:25),minimum=compact?(kind==='title'?24:kind==='artist'?18:16):(kind==='title'?34:kind==='artist'?25:22);
   node.style.fontSize=maximum+'px';
   const width=box.clientWidth,scale=width/Math.max(1,node.scrollWidth);
   node.style.fontSize=Math.max(minimum,Math.min(maximum,Math.floor(maximum*scale)))+'px';
   const distance=Math.max(0,node.scrollWidth-width);
   box.dataset.overflow=String(distance>2);
   box.style.setProperty('--text-travel',`${-distance}px`);
   box.style.setProperty('--text-duration',`${Math.max(12,distance/22+6)}s`);
  };
  const observer=new ResizeObserver(measure);observer.observe(box);measure();
  document.fonts?.ready.then(()=>{if(root.current===box)measure();});
  return()=>observer.disconnect();
 },[text,kind]);
 return <Tag ref={root} className={'track-text track-'+kind} aria-label={text}><span ref={line} aria-hidden="true">{text}</span></Tag>;
}
