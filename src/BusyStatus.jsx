import React from 'react';
import {tr} from '../shared/i18n.js';
import './busy-status.css';
export function BusyStatus({busy=true,label='Working…',name,className=''}){
 if(!busy)return null;
 return <p className={'busy-feedback '+className} role="status" aria-label={name?tr(name):undefined} aria-live="polite"><span className="ui-spinner" aria-hidden="true"/><span>{tr(label)}</span></p>;
}
