import {mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {preferenceDefaults,validatePreferences} from '../shared/preferences.js';
export class PreferencesStore{
 constructor(directory,initial={}){this.directory=directory;this.path=join(directory,'preferences.json');this.value={revision:0,...validatePreferences({...preferenceDefaults(),...initial})};try{const raw=readFileSync(this.path,'utf8');if(raw.length>65536)throw Error();const {revision,...prefs}=JSON.parse(raw);if(!Number.isSafeInteger(revision)||revision<0)throw Error();this.value={revision,...validatePreferences(prefs)};}catch{}}
 get(){return structuredClone(this.value);}
 save(revision,patch){if(revision!==this.value.revision){const e=Error('Settings changed on another screen. Reload before saving.');e.status=409;throw e;}if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('Invalid preference patch');const {revision:_,...old}=this.value;const value={revision:revision+1,...validatePreferences({...old,...patch})};mkdirSync(this.directory,{recursive:true,mode:0o700});writeFileSync(this.path+'.tmp',JSON.stringify(value)+'\n',{mode:0o600});renameSync(this.path+'.tmp',this.path);this.value=value;return this.get();}
 reset({setup=false}={}){return this.save(this.value.revision,{...preferenceDefaults(),setupCompleted:setup?false:this.value.setupCompleted});}
}
