import React from 'react';
import {tr} from '../shared/i18n.js';
export function GraphicsSetting({value='auto',onChange}){
 return <label className="graphics-setting">{tr('Graphics')}<select aria-label={tr('Graphics')} value={value} onChange={e=>onChange(e.target.value)}><option value="auto">{tr('Recommended for this device')}</option><option value="smooth">{tr('Smooth · fewer effects')}</option><option value="full">{tr('Full effects')}</option></select><small>{tr('Smooth uses a still background and simpler transitions. Music quality stays the same.')}</small></label>;
}
export function RangeSetting({label,value,min,max,step=1,unit='',onChange}){
 return <label className="range-setting"><span>{tr(label)}<output>{value}{unit}</output></span><input type="range" aria-label={tr(label)} min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))}/></label>;
}
export function VisualizerSettings({prefs,change}){
 return <fieldset className="visualizer-settings"><legend>{tr('Visualizer appearance')}</legend><RangeSetting label="Visualizer sensitivity" min={-12} max={12} value={prefs.visualizerSensitivity||0} onChange={v=>change('visualizerSensitivity',v)}/><label>{tr('Meter response')}<select aria-label={tr('Meter response')} value={prefs.visualizerResponse||'natural'} onChange={e=>change('visualizerResponse',e.target.value)}>{[['quick','Quick'],['natural','Natural'],['relaxed','Relaxed']].map(([id,label])=><option key={id} value={id}>{tr(label)}</option>)}</select></label><p>{tr('Changes only the movement and scale spacing. Audio gain, measured dBFS and synchronization stay unchanged.')}</p><button type="button" onClick={()=>{change('visualizerSensitivity',0);change('visualizerResponse','natural');}}>{tr('Reset visualizer appearance')}</button></fieldset>;
}
