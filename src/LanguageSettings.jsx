import {tr} from "../shared/i18n.js";
import React,{useSyncExternalStore} from 'react';
import {languages,getLanguage,setLanguage,subscribeLanguage} from '../shared/i18n.js';
export const useLanguage=()=>useSyncExternalStore(subscribeLanguage,getLanguage,()=> 'en');
export function LanguageSettings(){
  const current=useLanguage();
  return <section className="language-settings"><p>{tr("Choose the language used throughout TuneBox.")}</p><div>{languages.map(l=><button key={l.id} lang={l.id} aria-pressed={current===l.id} onClick={()=>setLanguage(l.id)}>{l.name}</button>)}</div><p>{tr("English is the default. Your selection is saved on this device.")}</p><a href="https://github.com/ducasebas/daw-one-music-interface/blob/main/docs/translations.md" target="_blank" rel="noreferrer">{tr("Help translate TuneBox on GitHub")}</a></section>;
}
