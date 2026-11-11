import { readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { displaySettings } from '../shared/display-settings.js';
export class DisplayStore {
  constructor(directory) { this.directory = directory; }
  load() { try { return displaySettings(JSON.parse(readFileSync(join(this.directory,'display.json'),'utf8'))); } catch { return displaySettings(); } }
  save(value) {
    const settings = displaySettings(value);
    mkdirSync(this.directory,{recursive:true,mode:0o700});
    const path = join(this.directory,'display.json');
    writeFileSync(path+'.tmp',JSON.stringify(settings)+'\n',{mode:0o600});
    renameSync(path+'.tmp',path);
    return settings;
  }
}
