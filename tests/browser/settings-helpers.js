import {settingsSections,settingsGroup} from '../../shared/interface.js';
import {translate} from '../../shared/i18n.js';
export async function chooseSettingsSection(page,name,{open=false}={}){
 const language=await page.locator('html').getAttribute('lang')||'en';
 const title=name==='Audio'?'Audio & DSP':name;
 const section=settingsSections.find(s=>s[1]===title);
 if(!section)throw Error('Unknown settings section: '+name);
 const group=settingsGroup(section[0]);
 if(open)await page.locator('.m2-header').getByRole('button',{name:translate('Settings',language),exact:true}).click();
 await page.getByRole('navigation',{name:translate('Settings categories',language)}).getByRole('button',{name:translate(group.id==='audio'?'Audio':group.title,language),exact:true}).click();
 if(section[0]!==group.id)await page.getByRole('navigation',{name:translate('In this section',language)}).getByRole('button',{name:translate(section[1],language),exact:true}).click();
 // Room measurement keeps its manual tools under "Advanced measurement tools" (the wizard is the main path).
 if(section[0]==='measurement')await page.locator('details.rc-advanced').evaluate(d=>{d.open=true;});
}

export async function chooseDeveloperTopic(page,topic,{open=false}={}){
 await chooseSettingsSection(page,'Developer',{open});
 const language=await page.locator('html').getAttribute('lang')||'en';
 const button=page.getByRole('navigation',{name:translate('Developer topics',language)}).getByRole('button',{name:translate(topic,language),exact:true});
 await button.click();
}
