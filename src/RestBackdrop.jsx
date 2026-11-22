import React from 'react';
import {backgroundModes,restPhotos} from '../shared/wall.js';
/** The backdrop behind a dark rest view; null when the view stays plain black. */
export function restBackdrop(screen,{artwork,restPhoto}={}){
 if(!backgroundModes.includes(screen.mode))return null;
 const bg=screen.background;
 if(bg==='art')return artwork?{kind:'art',image:artwork}:{kind:'gradient'};
 if(bg==='gradient')return {kind:'gradient'};
 if(restPhotos[bg])return {kind:'photo',image:restPhotos[bg]};
 if(bg==='own')return restPhoto?.current?{kind:'photo',image:'/api/rest-photo/current?v='+restPhoto.current.revision}:null;
 return null;
}
export function RestBackdrop({backdrop}){
 if(!backdrop)return null;
 return <span className="rest-backdrop" data-kind={backdrop.kind} aria-hidden="true">{backdrop.image&&<span style={{backgroundImage:`url("${String(backdrop.image).replace(/["\\]/g,'')}")`}}/>}</span>;
}
